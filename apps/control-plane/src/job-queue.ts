// =============================================================================
// TERMINUS CONTROL PLANE - Job Queue with Retry
// =============================================================================
// Manages job queue, retries, timeouts, and dead letter queue.
// =============================================================================

import { logger } from './logger.js';

export interface QueuedJob {
    jobId: string;
    runId: string;
    agentId: string;
    input: unknown;
    timeout: number;
    retryCount: number;
    maxRetries: number;
    createdAt: number;
    requiredCapabilities: string[];
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'DEAD';

interface JobRecord {
    job: QueuedJob;
    status: JobStatus;
    nodeId?: string;
    startedAt?: number;
    completedAt?: number;
    result?: unknown;
    error?: string;
}

// =============================================================================
// Queues
// =============================================================================

const pendingQueue: QueuedJob[] = [];
const runningJobs = new Map<string, JobRecord>();
const completedJobs = new Map<string, JobRecord>();
const deadLetterQueue: JobRecord[] = [];

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;

// =============================================================================
// Queue Operations
// =============================================================================

export function enqueue(job: Omit<QueuedJob, 'retryCount' | 'maxRetries' | 'createdAt'>): QueuedJob {
    const queuedJob: QueuedJob = {
        ...job,
        retryCount: 0,
        maxRetries: DEFAULT_MAX_RETRIES,
        createdAt: Date.now(),
    };

    pendingQueue.push(queuedJob);
    logger.info('Queue', `📥 Enqueued ${job.jobId} (pending: ${pendingQueue.length})`);
    return queuedJob;
}

export function dequeue(capabilities: string[]): QueuedJob | null {
    // Find first job that matches node capabilities
    const index = pendingQueue.findIndex(job =>
        job.requiredCapabilities.every(cap => capabilities.includes(cap))
    );

    if (index === -1) return null;

    const [job] = pendingQueue.splice(index, 1);
    return job;
}

export function markRunning(job: QueuedJob, nodeId: string): void {
    runningJobs.set(job.runId, {
        job,
        status: 'RUNNING',
        nodeId,
        startedAt: Date.now(),
    });
    logger.info('Queue', `▶️ Job ${job.jobId} running on ${nodeId}`);
}

export function markComplete(runId: string, success: boolean, result?: unknown, error?: string): void {
    const record = runningJobs.get(runId);
    if (!record) return;

    runningJobs.delete(runId);

    record.status = success ? 'SUCCESS' : 'FAILED';
    record.completedAt = Date.now();
    record.result = result;
    record.error = error;

    completedJobs.set(runId, record);
    logger.info('Queue', `${success ? '✅' : '❌'} Job ${record.job.jobId} ${record.status}`);
}

export function markTimeout(runId: string): void {
    const record = runningJobs.get(runId);
    if (!record) return;

    runningJobs.delete(runId);

    const job = record.job;
    job.retryCount++;

    if (job.retryCount >= job.maxRetries) {
        // Move to dead letter queue
        record.status = 'DEAD';
        record.error = `Exceeded max retries (${job.maxRetries})`;
        deadLetterQueue.push(record);
        logger.warn('Queue', `💀 Job ${job.jobId} moved to dead letter queue`);
    } else {
        // Retry
        pendingQueue.push(job);
        logger.warn('Queue', `🔄 Job ${job.jobId} requeued (attempt ${job.retryCount}/${job.maxRetries})`);
    }
}

// =============================================================================
// Timeout Checker
// =============================================================================

export function checkTimeouts(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [runId, record] of runningJobs) {
        const elapsed = now - (record.startedAt ?? now);
        if (elapsed > record.job.timeout) {
            timedOut.push(runId);
        }
    }

    timedOut.forEach(runId => markTimeout(runId));
    return timedOut;
}

// Start timeout checker
setInterval(checkTimeouts, 5000);

// =============================================================================
// Stats
// =============================================================================

export function getQueueStats() {
    return {
        pending: pendingQueue.length,
        running: runningJobs.size,
        completed: completedJobs.size,
        deadLetter: deadLetterQueue.length,
        recentDeadLetters: deadLetterQueue.slice(-5).map(r => ({
            jobId: r.job.jobId,
            error: r.error,
        })),
    };
}

export function getPendingJobs(): QueuedJob[] {
    return [...pendingQueue];
}

export function getRunningJobs(): JobRecord[] {
    return Array.from(runningJobs.values());
}
