// =============================================================================
// TERMINUS CONTROL PLANE - HTTP API
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { dispatchJob, getDispatcherStats } from './dispatcher.js';
import { handleAgentRoutes } from './agent-routes.js';
import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { getAllAgents, getAgentState } from './agent-store.js';

const HTTP_PORT = parseInt(process.env.HTTP_PORT ?? '3000', 10);

// =============================================================================
// Helpers
// =============================================================================

function sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
}

function sendError(res: ServerResponse, status: number, message: string): void {
    sendJson(res, status, { error: message });
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// =============================================================================
// Route Handlers
// =============================================================================

async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed');
        return;
    }

    try {
        const body = await parseBody(req) as {
            input?: unknown;
            agentId?: string;
            timeout?: number;
        };

        if (!body.input) {
            sendError(res, 400, 'Missing "input" field');
            return;
        }

        logger.info('HTTP', `📨 Run: ${JSON.stringify(body.input).slice(0, 50)}...`);

        const result = await dispatchJob({
            input: body.input,
            agentId: body.agentId,
            timeout: body.timeout,
        });

        if (result.success) {
            sendJson(res, 200, {
                success: true,
                jobId: result.jobId,
                runId: result.runId,
                output: result.result?.output,
                logs: result.result?.logs,
                metrics: result.result?.metrics,
            });
        } else {
            sendJson(res, 503, {
                success: false,
                jobId: result.jobId,
                error: result.error ?? result.result?.error,
            });
        }
    } catch (error) {
        sendError(res, 500, (error as Error).message);
    }
}

async function handleStatus(res: ServerResponse): Promise<void> {
    const nodeStats = nodeRegistry.getStats();
    const dispatcherStats = getDispatcherStats();
    const nodes = nodeRegistry.getOnlineNodes();
    const agents = getAllAgents();

    sendJson(res, 200, {
        status: 'ok',
        nodes: {
            total: nodeStats.total,
            online: nodeStats.online,
            idle: nodeRegistry.getIdleNodes().length,
            list: nodes.map(n => ({
                nodeId: n.nodeId,
                status: n.status,
                capabilities: n.capabilities,
            })),
        },
        agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            memory: getAgentState(a.id).memory,
        })),
        dispatcher: dispatcherStats,
    });
}

// =============================================================================
// HTTP Server
// =============================================================================

const server = createServer(async (req, res) => {
    const url = req.url ?? '';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // Agent routes
        if (url.startsWith('/api/agents')) {
            const handled = await handleAgentRoutes(req, res, url);
            if (handled) return;
        }

        // Other routes
        if (url === '/api/run' || url === '/api/run/') {
            await handleRun(req, res);
        } else if (url === '/api/status' || url === '/api/status/') {
            await handleStatus(res);
        } else if (url === '/' || url === '/health') {
            sendJson(res, 200, { status: 'ok', service: 'terminus-control-plane' });
        } else {
            sendError(res, 404, 'Not found');
        }
    } catch (error) {
        sendError(res, 500, 'Internal server error');
    }
});

export function startHttpServer(): void {
    server.listen(HTTP_PORT, () => {
        logger.info('HTTP', `🌐 HTTP API on port ${HTTP_PORT}`);
        logger.info('HTTP', `   POST /api/run - Submit job`);
        logger.info('HTTP', `   GET  /api/status - Cluster status`);
        logger.info('HTTP', `   GET  /api/agents - List agents`);
        logger.info('HTTP', `   POST /api/agents - Create agent`);
    });
}

export function stopHttpServer(): Promise<void> {
    return new Promise(resolve => server.close(() => resolve()));
}
