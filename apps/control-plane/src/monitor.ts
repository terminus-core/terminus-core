// =============================================================================
// TERMINUS CONTROL PLANE - Agent Monitor
// =============================================================================
// Tracks agent node status, connection history, and job metrics.
// Storage: Supabase PostgreSQL
// =============================================================================

import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { isSupabaseEnabled, insertLog as insertLogToDB, createJob, completeJob as completeJobInDB, getGlobalJobStats } from './database.js';
import { getWalletStats } from './payment/index.js';

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
// In-Memory Storage (synced with DB)
// =============================================================================

// Job stats per node
const nodeJobStats = new Map<string, { completed: number; failed: number }>();

// Global stats
const globalStats = { totalCompleted: 0, totalFailed: 0 };

// Load stats from Supabase on startup
async function loadStats(): Promise<void> {
    if (!isSupabaseEnabled()) return;

    try {
        const stats = await getGlobalJobStats();
        globalStats.totalCompleted = stats.totalCompleted;
        globalStats.totalFailed = stats.totalFailed;
        logger.info('Monitor', `📂 Loaded global job stats: ${stats.totalCompleted} completed, ${stats.totalFailed} failed`);

        // Note: Individual node stats are not fully reloaded here to avoid complexity,
        // but new jobs will be tracked correctly in DB.
    } catch (error) {
        logger.warn('Monitor', 'Could not load stats from DB');
    }
}

// Initialize stats
loadStats();

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

export function recordJobComplete(nodeId: string, success: boolean, jobId?: string): void {
    const stats = nodeJobStats.get(nodeId) || { completed: 0, failed: 0 };
    if (success) {
        stats.completed++;
        globalStats.totalCompleted++;
    } else {
        stats.failed++;
        globalStats.totalFailed++;
    }
    nodeJobStats.set(nodeId, stats);

    // Persist to Supabase
    if (isSupabaseEnabled() && jobId) {
        completeJobInDB(jobId, success).catch(() => { });
    }
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

    // Get agent earnings
    const walletStats = getWalletStats();

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
        earnings: {
            totalAgentEarnings: walletStats.totalEarnings,
            agentCount: walletStats.agentCount,
            perAgent: walletStats.wallets,
        },
        recentLogs: getLogs({ limit: 10 }),
    };
}
