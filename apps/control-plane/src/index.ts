// =============================================================================
// TERMINUS CONTROL PLANE
// =============================================================================
// The central orchestration server for the Terminus platform.
// Handles node registration, heartbeats, job routing, and HTTP API.
// =============================================================================

import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

// Load .env from terminus-core root (../../.env relative to apps/control-plane)
dotenvConfig({ path: join(process.cwd(), '../../.env') });

import { WebSocketServer, WebSocket } from 'ws';
import { config } from '@terminus/config';
import {
    type AuthMessage,
    type HeartbeatMessage,
    type TerminusMessage,
    type AuthAckMessage,
    type HeartbeatAckMessage,
    type ErrorMessage,
    type JobResultMessage,
    type AgentJobResultMessage,
    parseMessage,
    serializeMessage,
    createBaseMessage,
} from '@terminus/protocol';
import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { handleJobResult } from './dispatcher.js';
import { startHttpServer, stopHttpServer } from './http.js';
import { recordNodeConnection, recordNodeDisconnection } from './monitor.js';

// -----------------------------------------------------------------------------
// WebSocket Server Setup
// -----------------------------------------------------------------------------

const wss = new WebSocketServer({ port: config.controlPlane.port });

logger.info('Control Plane', `🚀 WebSocket server listening on port ${config.controlPlane.port}`);

// Track pending auth timeouts
const authTimeouts = new Map<WebSocket, NodeJS.Timeout>();

// -----------------------------------------------------------------------------
// Connection Handler
// -----------------------------------------------------------------------------

wss.on('connection', (socket: WebSocket) => {
    logger.info('Connection', '🔌 New connection received, awaiting AUTH...');

    // Set auth timeout - must receive AUTH within configured time
    const authTimeout = setTimeout(() => {
        logger.warn('Auth', '⏰ Auth timeout, closing connection');
        sendError(socket, 'AUTH_TIMEOUT', 'Authentication timeout', true);
        socket.close();
    }, config.timing.authTimeout);

    authTimeouts.set(socket, authTimeout);

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
        const raw = data.toString();
        const message = parseMessage(raw);

        if (!message) {
            logger.warn('Protocol', '⚠️ Invalid message format received');
            sendError(socket, 'INVALID_MESSAGE', 'Could not parse message', false);
            return;
        }

        handleMessage(socket, message);
    });

    // Handle disconnection
    socket.on('close', () => {
        // Clear auth timeout if still pending
        const timeout = authTimeouts.get(socket);
        if (timeout) {
            clearTimeout(timeout);
            authTimeouts.delete(socket);
        }

        // Find and remove node from registry
        const nodeId = nodeRegistry.findNodeIdBySocket(socket);
        if (nodeId) {
            recordNodeDisconnection(nodeId);
            nodeRegistry.unregister(nodeId);
            logger.connection(nodeId, 'disconnected');
        }
    });

    // Handle errors
    socket.on('error', (err) => {
        logger.error('Socket', `Socket error: ${err.message}`);
    });
});

// -----------------------------------------------------------------------------
// Message Handler
// -----------------------------------------------------------------------------

function handleMessage(socket: WebSocket, message: TerminusMessage): void {
    switch (message.type) {
        case 'AUTH':
            handleAuth(socket, message as AuthMessage);
            break;
        case 'HEARTBEAT':
            handleHeartbeat(socket, message as HeartbeatMessage);
            break;
        case 'JOB_RESULT':
            handleJobResult(message as JobResultMessage);
            break;
        case 'AGENT_JOB_RESULT':
            handleAgentJobResult(message as AgentJobResultMessage);
            break;
        default:
            logger.warn('Protocol', `Unexpected message type: ${message.type}`);
    }
}

// -----------------------------------------------------------------------------
// Auth Handler
// -----------------------------------------------------------------------------

function handleAuth(socket: WebSocket, message: AuthMessage): void {
    const { nodeId, capabilities, agentTypes, wallet, secret, version } = message.payload;

    // Clear auth timeout
    const timeout = authTimeouts.get(socket);
    if (timeout) {
        clearTimeout(timeout);
        authTimeouts.delete(socket);
    }

    // Validate secret (simple check for now)
    if (secret !== config.auth.nodeSecret) {
        logger.warn('Auth', `❌ Invalid secret from ${nodeId}`);
        sendAuthAck(socket, message.traceId, false, 'Invalid credentials');
        socket.close();
        return;
    }

    // Register node
    nodeRegistry.register(nodeId, socket, { capabilities, agentTypes, wallet, version });
    recordNodeConnection(nodeId, agentTypes || []);
    logger.connection(nodeId, 'authorized');
    logger.info('Capabilities', `📦 Node ${nodeId} capabilities: [${capabilities.join(', ')}]`);
    if (agentTypes?.length) {
        logger.info('Agents', `🤖 Node ${nodeId} agents: [${agentTypes.join(', ')}]`);
    }
    if (wallet) {
        logger.info('Wallet', `💳 Node ${nodeId} wallet: ${wallet.slice(0, 10)}...`);
    }

    // Send success acknowledgment
    sendAuthAck(socket, message.traceId, true, undefined, config.timing.heartbeatInterval);
}

// -----------------------------------------------------------------------------
// Heartbeat Handler
// -----------------------------------------------------------------------------

function handleHeartbeat(socket: WebSocket, message: HeartbeatMessage): void {
    const nodeId = nodeRegistry.findNodeIdBySocket(socket);

    if (!nodeId) {
        logger.warn('Heartbeat', '❌ Heartbeat from unregistered node');
        sendError(socket, 'NOT_REGISTERED', 'Node not registered', true);
        socket.close();
        return;
    }

    const { cpuUsage, memoryUsage, activeJobs } = message.payload;

    nodeRegistry.updateHeartbeat(nodeId, {
        cpuUsage,
        memoryUsage,
        activeJobs,
    });

    // Send acknowledgment
    sendHeartbeatAck(socket, message.traceId);
}

// -----------------------------------------------------------------------------
// Response Helpers
// -----------------------------------------------------------------------------

function sendAuthAck(socket: WebSocket, traceId: string, success: boolean, message?: string, heartbeatInterval?: number): void {
    const response: AuthAckMessage = {
        ...createBaseMessage('AUTH_ACK', traceId),
        type: 'AUTH_ACK',
        payload: { success, message, heartbeatInterval },
    };
    socket.send(serializeMessage(response));
}

function sendHeartbeatAck(socket: WebSocket, traceId: string): void {
    const response: HeartbeatAckMessage = {
        ...createBaseMessage('HEARTBEAT_ACK', traceId),
        type: 'HEARTBEAT_ACK',
        payload: { received: true },
    };
    socket.send(serializeMessage(response));
}

function sendError(socket: WebSocket, code: string, message: string, fatal: boolean): void {
    const response: ErrorMessage = {
        ...createBaseMessage('ERROR'),
        type: 'ERROR',
        payload: { code, message, fatal },
    };
    socket.send(serializeMessage(response));
}

// -----------------------------------------------------------------------------
// Start HTTP Server
// -----------------------------------------------------------------------------

startHttpServer();

// -----------------------------------------------------------------------------
// Pending Agent Jobs (for distributed execution)
// -----------------------------------------------------------------------------

interface PendingAgentJob {
    jobId: string;
    agentType: string;
    resolve: (result: { success: boolean; response: string; toolsUsed?: unknown[] }) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

const pendingAgentJobs = new Map<string, PendingAgentJob>();

export function dispatchAgentJob(
    agentType: string,
    userQuery: string,
    timeoutMs: number = 60000
): Promise<{ success: boolean; response: string; toolsUsed?: unknown[] }> {
    return new Promise((resolve, reject) => {
        // Find a node that can run this agent type
        const node = nodeRegistry.getIdleNodeForAgent(agentType);

        if (!node) {
            // No remote node available
            reject(new Error(`No node available for agent: ${agentType}`));
            return;
        }

        const socket = nodeRegistry.getSocket(node.nodeId);
        if (!socket) {
            reject(new Error(`No socket for node: ${node.nodeId}`));
            return;
        }

        const jobId = `agent-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Set timeout
        const timeout = setTimeout(() => {
            pendingAgentJobs.delete(jobId);
            reject(new Error(`Agent job timed out: ${jobId}`));
        }, timeoutMs);

        // Store pending job
        pendingAgentJobs.set(jobId, {
            jobId,
            agentType,
            resolve,
            reject,
            timeout,
        });

        // Send job to node
        const message = {
            type: 'AGENT_JOB',
            traceId: `trace-${Date.now()}`,
            timestamp: Date.now(),
            payload: {
                jobId,
                agentType,
                userQuery,
            },
        };

        socket.send(JSON.stringify(message));
        logger.info('AgentDispatch', `📤 Job ${jobId} sent to ${node.nodeId} for ${agentType}`);
    });
}

function handleAgentJobResult(message: AgentJobResultMessage): void {
    const { jobId, success, response, error } = message.payload;

    const pending = pendingAgentJobs.get(jobId);
    if (!pending) {
        logger.warn('AgentDispatch', `❓ Unknown job result: ${jobId}`);
        return;
    }

    clearTimeout(pending.timeout);
    pendingAgentJobs.delete(jobId);

    if (success) {
        logger.info('AgentDispatch', `✅ Job ${jobId} completed`);
        pending.resolve({ success: true, response, toolsUsed: message.payload.toolsUsed });
    } else {
        logger.error('AgentDispatch', `❌ Job ${jobId} failed: ${error?.message}`);
        pending.reject(new Error(error?.message || 'Agent job failed'));
    }
}

// -----------------------------------------------------------------------------
// Graceful Shutdown
// -----------------------------------------------------------------------------

process.on('SIGINT', async () => {
    logger.info('Control Plane', '🛑 Shutting down...');

    await stopHttpServer();

    wss.close(() => {
        logger.info('Control Plane', '👋 Goodbye!');
        process.exit(0);
    });
});

// Log stats periodically
setInterval(() => {
    const stats = nodeRegistry.getStats();
    const idleCount = nodeRegistry.getIdleNodes().length;
    if (stats.total > 0) {
        logger.info('Stats', `📊 Nodes: ${stats.online}/${stats.total} online, ${idleCount} idle`);
    }
}, 30000);
