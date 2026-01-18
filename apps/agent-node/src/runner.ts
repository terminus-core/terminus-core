// =============================================================================
// TERMINUS AGENT NODE - Sandbox Runner
// =============================================================================
// Executes agent code in an isolated VM context with timeout protection.
// =============================================================================

import { createContext, runInContext, Script } from 'vm';

export interface RunnerInput {
    jobId: string;
    runId: string;
    agentId: string;
    input: unknown;
    timeout?: number;
    context?: Record<string, unknown>;  // Previous memory/state
    script?: string;                     // Dynamic agent code
}

export interface RunnerOutput {
    status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
    output?: unknown;
    logs: string[];
    memory?: Record<string, unknown>;   // Updated memory to persist
    error?: {
        code: string;
        message: string;
        stack?: string;
    };
    metrics: {
        startTime: number;
        endTime: number;
        durationMs: number;
    };
}

const DEFAULT_TIMEOUT = 2000;

// Default agent code (used when no script provided)
const DEFAULT_AGENT_CODE = `
(function(input, memory) {
  console.log('[Agent] Received:', JSON.stringify(input));
  
  if (typeof input === 'string') {
    const reversed = input.split('').reverse().join('');
    console.log('[Agent] Reversed:', reversed);
    return { result: reversed };
  }
  
  if (input?.text) {
    const reversed = String(input.text).split('').reverse().join('');
    return { result: reversed };
  }
  
  if (input?.numbers && Array.isArray(input.numbers)) {
    const sum = input.numbers.reduce((a, b) => a + b, 0);
    return { result: sum };
  }
  
  return { result: input };
})(input, memory);
`;

export async function runAgent(runnerInput: RunnerInput): Promise<RunnerOutput> {
    const { input, timeout = DEFAULT_TIMEOUT, context = {}, script } = runnerInput;
    const logs: string[] = [];
    const startTime = Date.now();
    const memory = { ...context };

    try {
        const sandbox = {
            input,
            memory,
            console: {
                log: (...args: unknown[]) => {
                    logs.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
                },
                error: (...args: unknown[]) => {
                    logs.push(`[ERROR] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`);
                },
                warn: (...args: unknown[]) => {
                    logs.push(`[WARN] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`);
                },
            },
            JSON, Math, Date, Array, Object, String, Number, Boolean,
            parseInt, parseFloat, isNaN, isFinite,
        };

        const ctx = createContext(sandbox);
        const code = script ?? DEFAULT_AGENT_CODE;
        const compiled = new Script(code, { filename: 'agent.js' });
        const output = compiled.runInContext(ctx, { timeout });
        const endTime = Date.now();

        return {
            status: 'SUCCESS',
            output,
            logs,
            memory: sandbox.memory,
            metrics: { startTime, endTime, durationMs: endTime - startTime },
        };
    } catch (error) {
        const endTime = Date.now();
        const err = error as Error;

        if (err.message?.includes('Script execution timed out')) {
            logs.push(`[SYSTEM] Timeout after ${timeout}ms`);
            return {
                status: 'TIMEOUT',
                logs,
                error: { code: 'TIMEOUT', message: `Exceeded ${timeout}ms` },
                metrics: { startTime, endTime, durationMs: endTime - startTime },
            };
        }

        logs.push(`[SYSTEM] Error: ${err.message}`);
        return {
            status: 'ERROR',
            logs,
            error: { code: 'EXECUTION_ERROR', message: err.message, stack: err.stack },
            metrics: { startTime, endTime, durationMs: endTime - startTime },
        };
    }
}
