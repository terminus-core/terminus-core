// =============================================================================
// TERMINUS AGENT NODE
// =============================================================================
// The agent runtime that runs on user machines.
// Connects to Control Plane, sends heartbeats, and executes jobs in sandbox.
// =============================================================================

import { randomUUID } from 'crypto';
import { log, COLORS } from './logger.js';
import { connect, cleanup, closeSocket, setNodeInfo } from './connection.js';
import { discoverCapabilities } from './capabilities.js';
import { getAvailableTools } from './tools.js';

// -----------------------------------------------------------------------------
// Startup
// -----------------------------------------------------------------------------

async function main() {
    log('info', 'Node', `🚀 Terminus Agent Node starting...`);

    // Auto-discover capabilities
    log('info', 'Discovery', '🔍 Discovering capabilities...');
    const { capabilities, specs } = await discoverCapabilities();

    // Add tool capabilities
    const toolCaps = getAvailableTools().map(t => `tool:${t}`);
    const allCapabilities = [...capabilities, ...toolCaps];

    const NODE_ID = process.env.NODE_ID ?? `node-${randomUUID().slice(0, 8)}`;

    // Initialize node info
    setNodeInfo(NODE_ID, allCapabilities, specs);

    log('info', 'Node', `📛 Node ID: ${COLORS.magenta}${NODE_ID}${COLORS.reset}`);
    log('info', 'Node', `📦 Capabilities: [${allCapabilities.slice(0, 5).join(', ')}...]`);
    log('info', 'Node', `💻 Specs: ${specs.cpuCores} cores, ${specs.totalMemoryGB}GB RAM`);

    connect();
}

// -----------------------------------------------------------------------------
// Graceful Shutdown
// -----------------------------------------------------------------------------

process.on('SIGINT', () => {
    log('info', 'Node', '🛑 Shutting down...');
    cleanup();
    closeSocket();
    log('info', 'Node', '👋 Goodbye!');
    process.exit(0);
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

main().catch(err => {
    log('error', 'Node', `Fatal error: ${err.message}`);
    process.exit(1);
});
