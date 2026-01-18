// =============================================================================
// TERMINUS AGENT NODE - Job Handler
// =============================================================================

import {
    type JobAssignMessage,
    type JobResultMessage,
    serializeMessage,
    createBaseMessage,
} from '@terminus/protocol';
import { runAgent } from './runner.js';
import { executeTool } from './tools.js';
import { log, COLORS } from './logger.js';
import { getSocket, setStatus } from './connection.js';

let _activeJobs = 0;

export async function handleJobAssign(message: JobAssignMessage): Promise<void> {
    const { jobId, runId, agentId, input, timeout } = message.payload;
    const context = (message.payload as any).context;
    const script = (message.payload as any).script;
    const toolCall = (message.payload as any).toolCall;

    log('info', 'Job', `📥 Received job ${COLORS.blue}${jobId}${COLORS.reset}`);

    _activeJobs++;
    setStatus('BUSY', _activeJobs);

    const startTime = Date.now();

    try {
        let result: any;

        // Check if this is a direct tool call
        if (toolCall && toolCall.tool) {
            log('info', 'Job', `🔧 Executing tool: ${toolCall.tool}`);
            const toolResult = await executeTool(toolCall.tool, toolCall.params);
            result = {
                status: toolResult.success ? 'SUCCESS' : 'ERROR',
                output: toolResult.output,
                logs: [`[Tool] ${toolCall.tool}(${JSON.stringify(toolCall.params)})`],
                error: toolResult.error ? { code: 'TOOL_ERROR', message: toolResult.error } : undefined,
                metrics: {
                    startTime,
                    endTime: Date.now(),
                    durationMs: Date.now() - startTime,
                },
            };
        } else {
            // Run in sandbox
            log('info', 'Runner', `⚡ Executing in sandbox...`);
            result = await runAgent({ jobId, runId, agentId, input, timeout, context, script });
        }

        // Log captured output
        if (result.logs?.length > 0) {
            log('info', 'Runner', `📋 ${result.logs.length} log entries`);
        }

        // Send result
        const resultMessage: JobResultMessage = {
            ...createBaseMessage('JOB_RESULT', message.traceId),
            type: 'JOB_RESULT',
            payload: {
                jobId,
                runId,
                status: result.status,
                output: result.output,
                logs: result.logs || [],
                error: result.error,
                metrics: result.metrics,
            },
        };

        if (result.memory) {
            (resultMessage.payload as any).memory = result.memory;
        }

        getSocket()?.send(serializeMessage(resultMessage));

        const emoji = result.status === 'SUCCESS' ? '✅' : '❌';
        log('info', 'Job', `${emoji} ${jobId}: ${result.status} (${result.metrics.durationMs}ms)`);

    } catch (error) {
        const err = error as Error;
        log('error', 'Runner', `💥 Error: ${err.message}`);

        const errorResult: JobResultMessage = {
            ...createBaseMessage('JOB_RESULT', message.traceId),
            type: 'JOB_RESULT',
            payload: {
                jobId,
                runId,
                status: 'ERROR',
                logs: [`[SYSTEM] Error: ${err.message}`],
                error: { code: 'UNEXPECTED_ERROR', message: err.message, stack: err.stack },
                metrics: { startTime, endTime: Date.now(), durationMs: Date.now() - startTime },
            },
        };

        getSocket()?.send(serializeMessage(errorResult));
    } finally {
        _activeJobs--;
        if (_activeJobs === 0) setStatus('IDLE', 0);
    }
}
