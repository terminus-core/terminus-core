// =============================================================================
// TERMINUS AGENT NODE - Connection Handler
// =============================================================================

import WebSocket from 'ws';
import { config } from '@terminus/config';
import {
    type AuthMessage,
    type HeartbeatMessage,
    type TerminusMessage,
    type AuthAckMessage,
    type JobAssignMessage,
    type NodeStatus,
    parseMessage,
    serializeMessage,
    createBaseMessage,
} from '@terminus/protocol';
import { log, COLORS } from './logger.js';
import { getCpuUsage, getMemoryUsage } from './metrics.js';
import { handleJobAssign } from './job-handler.js';
import { discoverCapabilities, type NodeSpecs } from './capabilities.js';

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let socket: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let isAuthenticated = false;

export let currentStatus: NodeStatus = 'IDLE';
export let activeJobs = 0;
export let nodeId: string;
export let capabilities: string[];
export let specs: NodeSpecs;

export function setNodeInfo(id: string, caps: string[], nodeSpecs: NodeSpecs): void {
    nodeId = id;
    capabilities = caps;
    specs = nodeSpecs;
}

export function setStatus(status: NodeStatus, jobs: number): void {
    currentStatus = status;
    activeJobs = jobs;
}

export function getSocket(): WebSocket | null {
    return socket;
}

// -----------------------------------------------------------------------------
// Connect
// -----------------------------------------------------------------------------

export function connect(): void {
    const url = config.controlPlane.wsUrl;
    log('info', 'Connection', `🔌 Connecting to ${url}...`);

    socket = new WebSocket(url);

    socket.on('open', () => {
        log('info', 'Connection', '✅ Connected! Sending AUTH...');
        reconnectAttempt = 0;
        sendAuth();
    });

    socket.on('message', (data: Buffer) => {
        const raw = data.toString();
        const message = parseMessage(raw);
        if (!message) {
            log('warn', 'Protocol', '⚠️ Invalid message format');
            return;
        }
        handleMessage(message);
    });

    socket.on('close', () => {
        log('warn', 'Connection', '❌ Disconnected from Control Plane');
        cleanup();
        scheduleReconnect();
    });

    socket.on('error', (err) => {
        log('error', 'Socket', `Error: ${err.message}`);
    });
}

// -----------------------------------------------------------------------------
// Message Handler
// -----------------------------------------------------------------------------

function handleMessage(message: TerminusMessage): void {
    switch (message.type) {
        case 'AUTH_ACK':
            handleAuthAck(message as AuthAckMessage);
            break;
        case 'HEARTBEAT_ACK':
            break;
        case 'JOB_ASSIGN':
            handleJobAssign(message as JobAssignMessage);
            break;
        case 'ERROR':
            log('error', 'Server', `Error: ${message.payload.code} - ${message.payload.message}`);
            if (message.payload.fatal) cleanup();
            break;
        default:
            log('warn', 'Protocol', `Unhandled message type: ${message.type}`);
    }
}

function handleAuthAck(message: AuthAckMessage): void {
    if (message.payload.success) {
        log('info', 'Auth', `🎉 Authenticated as ${COLORS.magenta}${nodeId}${COLORS.reset}`);
        isAuthenticated = true;
        startHeartbeat(message.payload.heartbeatInterval ?? config.timing.heartbeatInterval);
    } else {
        log('error', 'Auth', `❌ Auth failed: ${message.payload.message}`);
        socket?.close();
    }
}

// -----------------------------------------------------------------------------
// Send Messages
// -----------------------------------------------------------------------------

function sendAuth(): void {
    const message: AuthMessage = {
        ...createBaseMessage('AUTH'),
        type: 'AUTH',
        payload: {
            nodeId,
            capabilities,
            specs,
            secret: config.auth.nodeSecret,
            version: '0.1.0',
        },
    };
    socket?.send(serializeMessage(message));
}

function sendHeartbeat(): void {
    if (!isAuthenticated || !socket || socket.readyState !== WebSocket.OPEN) return;

    const message: HeartbeatMessage = {
        ...createBaseMessage('HEARTBEAT'),
        type: 'HEARTBEAT',
        payload: {
            status: currentStatus,
            cpuUsage: getCpuUsage(),
            memoryUsage: getMemoryUsage(),
            activeJobs,
        },
    };

    socket.send(serializeMessage(message));
    log('info', 'Heartbeat', `💓 Sent (Status: ${currentStatus}, Jobs: ${activeJobs})`);
}

// -----------------------------------------------------------------------------
// Heartbeat & Reconnect
// -----------------------------------------------------------------------------

function startHeartbeat(intervalMs: number): void {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    log('info', 'Heartbeat', `⏱️ Starting heartbeat every ${intervalMs / 1000}s`);
    heartbeatInterval = setInterval(sendHeartbeat, intervalMs);
    sendHeartbeat();
}

function scheduleReconnect(): void {
    const { reconnectBaseDelay, reconnectMaxDelay, reconnectMultiplier } = config.timing;
    const delay = Math.min(
        reconnectBaseDelay * Math.pow(reconnectMultiplier, reconnectAttempt),
        reconnectMaxDelay
    );
    reconnectAttempt++;
    log('info', 'Reconnect', `🔄 Attempting in ${delay / 1000}s (attempt ${reconnectAttempt})`);
    setTimeout(connect, delay);
}

export function cleanup(): void {
    isAuthenticated = false;
    currentStatus = 'IDLE';
    activeJobs = 0;
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

export function closeSocket(): void {
    socket?.close();
}
