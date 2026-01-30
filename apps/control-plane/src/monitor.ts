// =============================================================================
// TERMINUS CONTROL PLANE - Agent Monitor
// =============================================================================
// Tracks agent node status, connection history, and job metrics.
// =============================================================================

import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isSupabaseEnabled, insertLog as insertLogToDB, createJob, completeJob as completeJobInDB, getGlobalJobStats } from './database.js';

// Persistence file path
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const STATS_FILE = join(DATA_DIR, 'job-stats.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// =============================================================================
// Types
// =============================================================================

export interface AgentNodeStatus {
    nodeId: string;
    agentTypes: string[];
    wallet?: string;
    status: 'ONLINE' | 'OFFLINE' | 'STALE';
    connectedAt: number;
    lastHeartbeat: number;
    heartbeatAgeMs: number;
    metrics: {
        cpuUsage: number;
        memoryUsage: number;
        activeJobs: number;
        totalJobsCompleted: number;
        totalJobsFailed: number;
    };
}

export interface LogEntry {
    timestamp: number;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    source: string;
    message: string;
    nodeId?: string;
    jobId?: string;
}

// =============================================================================
// Persistent Storage
// =============================================================================

interface PersistedStats {
    nodeJobStats: Record<string, { completed: number; failed: number }>;
    globalStats: { totalCompleted: number; totalFailed: number };
}

function loadStats(): PersistedStats {
    try {
        if (existsSync(STATS_FILE)) {
            const data = readFileSync(STATS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        logger.warn('Monitor', 'Could not load persisted stats, starting fresh');
    }
    return { nodeJobStats: {}, globalStats: { totalCompleted: 0, totalFailed: 0 } };
}

function saveStats(): void {
    try {
        const data: PersistedStats = {
            nodeJobStats: Object.fromEntries(nodeJobStats),
            globalStats,
        };
        writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error('Monitor', `Failed to save stats: ${(error as Error).message}`);
    }
}

// Load persisted stats on startup
const persistedStats = loadStats();
const nodeJobStats = new Map<string, { completed: number; failed: number }>(
    Object.entries(persistedStats.nodeJobStats)
);
const globalStats = persistedStats.globalStats;

// Centralized log buffer (last N entries)
const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];

// Connection history
const connectionHistory: Array<{
    nodeId: string;
    agentTypes: string[];
    event: 'CONNECTED' | 'DISCONNECTED';
    timestamp: number;
}> = [];

// =============================================================================
// Log Collection
// =============================================================================

export function addLog(
    level: LogEntry['level'],
    source: string,
    message: string,
    nodeId?: string,
    jobId?: string
): void {
    const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        source,
        message,
        nodeId,
        jobId,
    };

    logBuffer.push(entry);

    // Trim buffer if needed
    if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
    }

    // Sync to Supabase (async, fire and forget)
    if (isSupabaseEnabled()) {
        insertLogToDB({ level, source, message, node_id: nodeId, job_id: jobId })
            .catch(() => { }); // Silent fail
    }
}

export function getLogs(options?: {
    level?: LogEntry['level'];
    source?: string;
    nodeId?: string;
    limit?: number;
}): LogEntry[] {
    let logs = [...logBuffer];

    if (options?.level) {
        logs = logs.filter(l => l.level === options.level);
    }
    if (options?.source) {
        const src = options.source;
        logs = logs.filter(l => l.source.includes(src));
    }
    if (options?.nodeId) {
        logs = logs.filter(l => l.nodeId === options.nodeId);
    }

    const limit = options?.limit || 100;
    return logs.slice(-limit).reverse();
}

// =============================================================================
// Node Event Tracking
// =============================================================================

export function recordNodeConnection(nodeId: string, agentTypes: string[]): void {
    connectionHistory.push({
        nodeId,
        agentTypes,
        event: 'CONNECTED',
        timestamp: Date.now(),
    });

    // Initialize job stats
    if (!nodeJobStats.has(nodeId)) {
        nodeJobStats.set(nodeId, { completed: 0, failed: 0 });
    }

    addLog('INFO', 'Monitor', `Node ${nodeId} connected with agents: [${agentTypes.join(', ')}]`, nodeId);
}

export function recordNodeDisconnection(nodeId: string): void {
    const node = nodeRegistry.get(nodeId);
    connectionHistory.push({
        nodeId,
        agentTypes: node?.agentTypes || [],
        event: 'DISCONNECTED',
        timestamp: Date.now(),
    });

    addLog('WARN', 'Monitor', `Node ${nodeId} disconnected`, nodeId);
}

export function recordJobComplete(nodeId: string, success: boolean): void {
    const stats = nodeJobStats.get(nodeId) || { completed: 0, failed: 0 };
    if (success) {
        stats.completed++;
        globalStats.totalCompleted++;
    } else {
        stats.failed++;
        globalStats.totalFailed++;
    }
    nodeJobStats.set(nodeId, stats);
    saveStats();
}

// =============================================================================
// Status Queries
// =============================================================================

export function getAgentNodesStatus(): AgentNodeStatus[] {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 30000; // 30 seconds without heartbeat = stale

    const nodes = nodeRegistry.getOnlineNodes();

    return nodes.map(node => {
        const heartbeatAge = now - node.lastHeartbeat;
        const jobStats = nodeJobStats.get(node.nodeId) || { completed: 0, failed: 0 };

        let status: 'ONLINE' | 'OFFLINE' | 'STALE' = node.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
        if (status === 'ONLINE' && heartbeatAge > STALE_THRESHOLD_MS) {
            status = 'STALE';
        }

        return {
            nodeId: node.nodeId,
            agentTypes: node.agentTypes || [],
            wallet: node.wallet,
            status,
            connectedAt: node.connectedAt,
            lastHeartbeat: node.lastHeartbeat,
            heartbeatAgeMs: heartbeatAge,
            metrics: {
                cpuUsage: node.metrics.cpuUsage,
                memoryUsage: node.metrics.memoryUsage,
                activeJobs: node.metrics.activeJobs,
                totalJobsCompleted: jobStats.completed,
                totalJobsFailed: jobStats.failed,
            },
        };
    });
}

export function getConnectionHistory(limit: number = 50) {
    return connectionHistory.slice(-limit).reverse();
}

export function getMonitoringSummary() {
    const nodes = getAgentNodesStatus();
    const online = nodes.filter(n => n.status === 'ONLINE').length;
    const stale = nodes.filter(n => n.status === 'STALE').length;
    const offline = nodes.filter(n => n.status === 'OFFLINE').length;

    const allAgentTypes = new Set<string>();
    nodes.forEach(n => n.agentTypes.forEach(a => allAgentTypes.add(a)));

    const totalJobs = nodes.reduce((sum, n) => sum + n.metrics.totalJobsCompleted + n.metrics.totalJobsFailed, 0);
    const successRate = totalJobs > 0
        ? nodes.reduce((sum, n) => sum + n.metrics.totalJobsCompleted, 0) / totalJobs * 100
        : 100;

    return {
        timestamp: Date.now(),
        nodes: {
            total: nodes.length,
            online,
            stale,
            offline,
        },
        agentTypes: Array.from(allAgentTypes),
        jobs: {
            total: totalJobs,
            successRate: Math.round(successRate * 100) / 100,
        },
        recentLogs: getLogs({ limit: 10 }),
    };
}
