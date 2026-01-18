// =============================================================================
// TERMINUS CONTROL PLANE - Dispatcher
// =============================================================================
// Handles job assignment with agent context and state persistence.
// =============================================================================

import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import {
    type JobAssignMessage,
    type JobResultMessage,
    serializeMessage,
    createBaseMessage,
} from '@terminus/protocol';
import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { getAgent, getAgentState, updateAgentState } from './agent-store.js';

// Pending job tracker
interface PendingJob {
    jobId: string;
    runId: string;
    nodeId: string;
    agentId: string;
    resolve: (result: JobResultMessage['payload']) => void;
    reject: (error: Error) => void;
}

const pendingJobs = new Map<string, PendingJob>();

// =============================================================================
// Dispatch Job
// =============================================================================

export interface DispatchOptions {
    input: unknown;
    agentId?: string;
    timeout?: number;
}

export interface DispatchResult {
    success: boolean;
    jobId?: string;
    runId?: string;
    result?: JobResultMessage['payload'];
    error?: string;
}

export async function dispatchJob(options: DispatchOptions): Promise<DispatchResult> {
    const { input, agentId = 'default', timeout = 10000 } = options;

    // Find idle node
    const idleNodes = nodeRegistry.getIdleNodes();
    if (idleNodes.length === 0) {
        logger.warn('Dispatcher', '⚠️ No idle nodes available');
        return { success: false, error: 'No idle nodes available' };
    }

    const selectedNode = idleNodes[0];
    const socket = nodeRegistry.getSocket(selectedNode.nodeId);
    if (!socket) {
        return { success: false, error: 'Node socket not found' };
    }

    // Get agent and its state
    const agent = getAgent(agentId);
    const agentState = getAgentState(agentId);

    const jobId = `job-${randomUUID().slice(0, 8)}`;
    const runId = `run-${randomUUID().slice(0, 8)}`;

    logger.info('Dispatcher', `📤 Dispatching ${jobId} to ${selectedNode.nodeId}`);

    // Create result promise
    const resultPromise = new Promise<JobResultMessage['payload']>((resolve, reject) => {
        pendingJobs.set(runId, {
            jobId, runId, nodeId: selectedNode.nodeId, agentId, resolve, reject,
        });

        setTimeout(() => {
            if (pendingJobs.has(runId)) {
                pendingJobs.delete(runId);
                reject(new Error(`Timeout after ${timeout}ms`));
            }
        }, timeout);
    });

    // Build job message with context
    const jobMessage: JobAssignMessage = {
        ...createBaseMessage('JOB_ASSIGN'),
        type: 'JOB_ASSIGN',
        payload: {
            jobId,
            runId,
            agentId,
            input,
            timeout: timeout - 1000,
        },
    };

    // Inject agent script and context
    if (agent) {
        (jobMessage.payload as any).script = agent.script;
    }
    (jobMessage.payload as any).context = agentState.memory;

    socket.send(serializeMessage(jobMessage));

    try {
        const result = await resultPromise;
        logger.info('Dispatcher', `✅ Job ${jobId}: ${result.status}`);
        return { success: result.status === 'SUCCESS', jobId, runId, result };
    } catch (error) {
        logger.error('Dispatcher', `❌ Job ${jobId}: ${(error as Error).message}`);
        return { success: false, jobId, runId, error: (error as Error).message };
    }
}

// =============================================================================
// Handle Job Result
// =============================================================================

export function handleJobResult(message: JobResultMessage): void {
    const { runId, jobId, status } = message.payload;

    logger.info('Dispatcher', `📥 Result for ${jobId}: ${status}`);

    const pending = pendingJobs.get(runId);
    if (!pending) {
        logger.warn('Dispatcher', `⚠️ No pending job for runId: ${runId}`);
        return;
    }

    pendingJobs.delete(runId);

    // Persist updated memory
    const memory = (message.payload as any).memory;
    if (memory && pending.agentId) {
        updateAgentState(pending.agentId, memory);
        logger.info('Dispatcher', `💾 Saved memory for agent ${pending.agentId}`);
    }

    // Log captured logs
    if (message.payload.logs?.length > 0) {
        logger.info('Dispatcher', `📋 Logs (${message.payload.logs.length}):`);
        message.payload.logs.forEach((line: string, i: number) => {
            logger.info('Dispatcher', `   ${i + 1}. ${line}`);
        });
    }

    pending.resolve(message.payload);
}

// =============================================================================
// Stats
// =============================================================================

export function getDispatcherStats() {
    return {
        pendingJobs: pendingJobs.size,
        pendingJobIds: Array.from(pendingJobs.values()).map(j => j.jobId),
    };
}
