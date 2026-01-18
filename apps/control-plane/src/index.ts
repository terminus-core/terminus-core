// =============================================================================
// TERMINUS CONTROL PLANE
// =============================================================================
// The central orchestration server for the Terminus platform.
// Handles node registration, heartbeats, job routing, and HTTP API.
// =============================================================================

import 'dotenv/config';

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
    parseMessage,
    serializeMessage,
    createBaseMessage,
} from '@terminus/protocol';
import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { handleJobResult } from './dispatcher.js';
import { startHttpServer, stopHttpServer } from './http.js';

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
        default:
            logger.warn('Protocol', `Unexpected message type: ${message.type}`);
    }
}

// -----------------------------------------------------------------------------
// Auth Handler
// -----------------------------------------------------------------------------

function handleAuth(socket: WebSocket, message: AuthMessage): void {
    const { nodeId, capabilities, secret, version } = message.payload;

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
    nodeRegistry.register(nodeId, socket, { capabilities, version });
    logger.connection(nodeId, 'authorized');
    logger.info('Capabilities', `📦 Node ${nodeId} capabilities: [${capabilities.join(', ')}]`);

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
