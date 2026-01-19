// =============================================================================
// TERMINUS CONTROL PLANE - HTTP API
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { dispatchJob, getDispatcherStats } from './dispatcher.js';
import { handleAgentRoutes } from './agent-routes.js';
import { nodeRegistry } from './registry.js';
import { logger } from './logger.js';
import { getAllAgents, getAgentState } from './agent-store.js';
import { executeMultiAgent } from './orchestrator.js';
import { AGENTS } from './agents-registry.js';
import { checkPayment, settlePayment, distributePayment, getPaymentConfig, getPaymentStats, getWalletStats, getAllTransactions } from './payment/index.js';
import { getAgentNodesStatus, getLogs, getConnectionHistory, getMonitoringSummary } from './monitor.js';

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
// Chat with LLM (Multi-Agent)
// =============================================================================

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed');
        return;
    }

    try {
        // Check payment (returns 402 if payment required and not provided)
        const paymentCheck = await checkPayment(req, res, '/api/chat', 'Multi-agent chat query');
        if (!paymentCheck.paymentVerified) {
            return; // Response already sent by checkPayment
        }

        const body = await parseBody(req) as { message?: string };

        if (!body.message) {
            sendError(res, 400, 'Missing "message" field');
            return;
        }

        logger.info('HTTP', `💬 Chat: "${body.message.slice(0, 50)}..."`);

        // Execute multi-agent flow
        const result = await executeMultiAgent(body.message);

        logger.info('HTTP', `✅ Chat complete (${result.agentsUsed.length} agents)`);

        // Distribute payment to agents if payment was made
        const config = getPaymentConfig();
        let paymentInfo = null;
        if (config.enabled && paymentCheck.paymentPayload && paymentCheck.requirement) {
            // Settle the payment on-chain
            const settlement = await settlePayment(paymentCheck.paymentPayload, paymentCheck.requirement);

            // Get user wallet from headers
            const userWallet = req.headers['x-wallet-address'] as string || 'unknown';
            const userTxHash = req.headers['x-payment-tx'] as string || undefined;

            // Distribute to orchestrator and agents
            const distribution = await distributePayment(config.queryPriceUSDC, result.agentsUsed, userWallet, userTxHash);
            paymentInfo = {
                settled: settlement.success,
                txHash: settlement.txHash,
                distribution: {
                    total: distribution.totalAmount,
                    orchestrator: distribution.orchestratorAmount,
                    agents: distribution.agentPayments,
                },
            };
        }

        sendJson(res, 200, {
            success: result.success,
            message: result.finalResponse,
            agentsUsed: result.agentsUsed,
            agentResults: result.agentResults.map(r => ({
                agent: r.agentName,
                tools: r.toolCalls.map(t => t.tool),
                summary: r.summary.slice(0, 200) + (r.summary.length > 200 ? '...' : ''),
            })),
            payment: paymentInfo,
        });
    } catch (error) {
        logger.error('HTTP', `Chat error: ${(error as Error).message}`);
        sendError(res, 500, (error as Error).message);
    }
}

// =============================================================================
// HTTP Server
// =============================================================================

const server = createServer(async (req, res) => {
    const url = req.url ?? '';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Wallet-Address, X-Payment-Tx');

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
        } else if (url === '/api/chat' || url === '/api/chat/') {
            await handleChat(req, res);
        } else if (url === '/api/status' || url === '/api/status/') {
            await handleStatus(res);
        } else if (url === '/api/payments' || url === '/api/payments/') {
            // Payment stats endpoint
            const paymentStats = getPaymentStats();
            const walletStats = getWalletStats();
            const config = getPaymentConfig();
            sendJson(res, 200, {
                enabled: config.enabled,
                network: config.network,
                queryPrice: config.queryPriceUSDC,
                stats: paymentStats,
                wallets: walletStats,
            });
        } else if (url === '/api/transactions' || url === '/api/transactions/') {
            // Recent transactions
            const transactions = getAllTransactions(50);
            sendJson(res, 200, { transactions });
        } else if (url === '/api/monitor' || url === '/api/monitor/') {
            // Monitoring summary
            const summary = getMonitoringSummary();
            sendJson(res, 200, summary);
        } else if (url === '/api/monitor/nodes' || url === '/api/monitor/nodes/') {
            // Agent nodes status
            const nodes = getAgentNodesStatus();
            sendJson(res, 200, { nodes });
        } else if (url === '/api/monitor/logs' || url === '/api/monitor/logs/') {
            // Recent logs
            const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
            const level = urlObj.searchParams.get('level') as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | undefined;
            const source = urlObj.searchParams.get('source') || undefined;
            const nodeId = urlObj.searchParams.get('nodeId') || undefined;
            const limit = parseInt(urlObj.searchParams.get('limit') || '100', 10);
            const logs = getLogs({ level, source, nodeId, limit });
            sendJson(res, 200, { logs });
        } else if (url === '/api/monitor/history' || url === '/api/monitor/history/') {
            // Connection history
            const history = getConnectionHistory(50);
            sendJson(res, 200, { history });
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
        logger.info('HTTP', `   POST /api/chat - Chat with Grok LLM`);
        logger.info('HTTP', `   POST /api/run - Submit job`);
        logger.info('HTTP', `   GET  /api/status - Cluster status`);
        logger.info('HTTP', `   GET  /api/agents - List agents`);
        logger.info('HTTP', `   POST /api/agents - Create agent`);
    });
}

export function stopHttpServer(): Promise<void> {
    return new Promise(resolve => server.close(() => resolve()));
}
