// =============================================================================
// TERMINUS CONTROL PLANE - Agent API Routes
// =============================================================================

import type { IncomingMessage, ServerResponse } from 'http';
import {
    createAgent,
    getAgent,
    getAllAgents,
    updateAgent,
    deleteAgent,
    type Agent,
} from './agent-store.js';
import { logger } from './logger.js';

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
// Route Handler
// =============================================================================

export async function handleAgentRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    url: string
): Promise<boolean> {
    // List all agents
    if (url === '/api/agents' && req.method === 'GET') {
        const agents = getAllAgents();
        sendJson(res, 200, { agents });
        return true;
    }

    // Create agent
    if (url === '/api/agents' && req.method === 'POST') {
        try {
            const body = await parseBody(req) as Partial<Agent>;

            if (!body.name || !body.script) {
                sendError(res, 400, 'Missing required fields: name, script');
                return true;
            }

            const agent = createAgent({
                name: body.name,
                description: body.description ?? '',
                systemPrompt: body.systemPrompt ?? '',
                script: body.script,
                capabilities: body.capabilities ?? [],
            });

            logger.info('Agents', `📦 Created agent: ${agent.name} (${agent.id})`);
            sendJson(res, 201, { agent });
            return true;
        } catch (err) {
            sendError(res, 400, (err as Error).message);
            return true;
        }
    }

    // Get single agent
    const singleMatch = url.match(/^\/api\/agents\/([^/]+)$/);
    if (singleMatch && req.method === 'GET') {
        const agent = getAgent(singleMatch[1]);
        if (!agent) {
            sendError(res, 404, 'Agent not found');
            return true;
        }
        sendJson(res, 200, { agent });
        return true;
    }

    // Update agent
    if (singleMatch && req.method === 'PATCH') {
        try {
            const body = await parseBody(req) as Partial<Agent>;
            const agent = updateAgent(singleMatch[1], body);
            if (!agent) {
                sendError(res, 404, 'Agent not found');
                return true;
            }
            sendJson(res, 200, { agent });
            return true;
        } catch (err) {
            sendError(res, 400, (err as Error).message);
            return true;
        }
    }

    // Delete agent
    if (singleMatch && req.method === 'DELETE') {
        const deleted = deleteAgent(singleMatch[1]);
        if (!deleted) {
            sendError(res, 404, 'Agent not found');
            return true;
        }
        sendJson(res, 200, { deleted: true });
        return true;
    }

    return false;
}
