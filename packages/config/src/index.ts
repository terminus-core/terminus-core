// =============================================================================
// TERMINUS CONFIG - Shared Configuration
// =============================================================================

export const config = {
    // Network
    controlPlane: {
        host: process.env.CONTROL_PLANE_HOST ?? 'localhost',
        port: parseInt(process.env.CONTROL_PLANE_PORT ?? '8080', 10),
        get wsUrl() {
            return `ws://${this.host}:${this.port}`;
        },
    },

    // Timing
    timing: {
        heartbeatInterval: 5000,       // How often nodes send heartbeat (ms)
        heartbeatTimeout: 15000,       // Max time without heartbeat before disconnect (ms)
        authTimeout: 10000,            // Max time to receive AUTH after connection (ms)
        reconnectBaseDelay: 1000,      // Initial reconnect delay (ms)
        reconnectMaxDelay: 30000,      // Maximum reconnect delay (ms)
        reconnectMultiplier: 2,        // Exponential backoff multiplier
    },

    // Secrets (replace with proper auth later)
    auth: {
        nodeSecret: process.env.NODE_SECRET ?? 'terminus-dev-secret',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL ?? 'info',
        timestamps: true,
    },
} as const;

export type Config = typeof config;
