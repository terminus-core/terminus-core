import { config } from '@terminus/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: COLORS.dim,
    info: COLORS.green,
    warn: COLORS.yellow,
    error: COLORS.red,
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private minLevel: number;

    constructor() {
        this.minLevel = LEVEL_PRIORITY[config.logging.level as LogLevel] ?? 1;
    }

    private format(level: LogLevel, tag: string, message: string): string {
        const timestamp = config.logging.timestamps
            ? `${COLORS.dim}${new Date().toISOString()}${COLORS.reset} `
            : '';
        const levelStr = `${LEVEL_COLORS[level]}[${level.toUpperCase()}]${COLORS.reset}`;
        const tagStr = `${COLORS.cyan}[${tag}]${COLORS.reset}`;
        return `${timestamp}${levelStr} ${tagStr} ${message}`;
    }

    private log(level: LogLevel, tag: string, message: string): void {
        if (LEVEL_PRIORITY[level] >= this.minLevel) {
            console.log(this.format(level, tag, message));
        }
    }

    debug(tag: string, message: string): void {
        this.log('debug', tag, message);
    }

    info(tag: string, message: string): void {
        this.log('info', tag, message);
    }

    warn(tag: string, message: string): void {
        this.log('warn', tag, message);
    }

    error(tag: string, message: string): void {
        this.log('error', tag, message);
    }

    // Convenience methods for common events
    connection(nodeId: string, action: 'connected' | 'disconnected' | 'authorized'): void {
        const emoji = action === 'connected' ? '🔌' : action === 'authorized' ? '✅' : '❌';
        this.info('Connection', `${emoji} Node ${COLORS.magenta}${nodeId}${COLORS.reset} ${action}`);
    }

    heartbeat(nodeId: string, cpu: number, memory: number): void {
        this.debug('Heartbeat', `💓 Node ${COLORS.magenta}${nodeId}${COLORS.reset} alive (CPU: ${cpu}%, MEM: ${memory}%)`);
    }
}

export const logger = new Logger();
