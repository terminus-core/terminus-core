// =============================================================================
// TERMINUS AGENT NODE - Logger
// =============================================================================

export const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
};

export function log(level: 'info' | 'warn' | 'error', tag: string, message: string): void {
    const colors = { info: COLORS.green, warn: COLORS.yellow, error: COLORS.red };
    const timestamp = `${COLORS.dim}${new Date().toISOString()}${COLORS.reset}`;
    const levelStr = `${colors[level]}[${level.toUpperCase()}]${COLORS.reset}`;
    const tagStr = `${COLORS.cyan}[${tag}]${COLORS.reset}`;
    console.log(`${timestamp} ${levelStr} ${tagStr} ${message}`);
}
