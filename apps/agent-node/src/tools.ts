// =============================================================================
// TERMINUS AGENT NODE - Tools
// =============================================================================
// Real executable tools that nodes can run in the sandbox.
// =============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as http from 'http';

const execAsync = promisify(exec);

export interface ToolResult {
    success: boolean;
    output?: unknown;
    error?: string;
}

// =============================================================================
// Tool Implementations
// =============================================================================

export async function webSearch(query: string): Promise<ToolResult> {
    // For demo, we'll simulate search with DuckDuckGo instant answers
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;
        const data = await fetchJson(url);

        return {
            success: true,
            output: {
                query,
                abstract: data.Abstract || 'No results found',
                relatedTopics: (data.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text),
                source: data.AbstractSource || 'DuckDuckGo',
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Search failed: ${(error as Error).message}`,
        };
    }
}

export async function fetchUrl(url: string): Promise<ToolResult> {
    try {
        const content = await fetchText(url);
        // Limit content size
        const truncated = content.slice(0, 5000);

        return {
            success: true,
            output: {
                url,
                contentLength: content.length,
                preview: truncated,
                truncated: content.length > 5000,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Fetch failed: ${(error as Error).message}`,
        };
    }
}

export async function calculateSum(numbers: number[]): Promise<ToolResult> {
    try {
        const sum = numbers.reduce((a, b) => a + b, 0);
        return {
            success: true,
            output: { numbers, sum, count: numbers.length },
        };
    } catch (error) {
        return {
            success: false,
            error: `Calculation failed: ${(error as Error).message}`,
        };
    }
}

export async function reverseText(text: string): Promise<ToolResult> {
    try {
        const reversed = text.split('').reverse().join('');
        return {
            success: true,
            output: { original: text, reversed },
        };
    } catch (error) {
        return {
            success: false,
            error: `Reverse failed: ${(error as Error).message}`,
        };
    }
}

export async function runShellCommand(command: string): Promise<ToolResult> {
    // Only allow safe commands
    const allowedPrefixes = ['echo', 'date', 'whoami', 'uname'];
    const isAllowed = allowedPrefixes.some(p => command.startsWith(p));

    if (!isAllowed) {
        return {
            success: false,
            error: 'Command not in allowlist',
        };
    }

    try {
        const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
        return {
            success: true,
            output: { stdout: stdout.trim(), stderr: stderr.trim() },
        };
    } catch (error) {
        return {
            success: false,
            error: `Command failed: ${(error as Error).message}`,
        };
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

function fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({}); }
            });
        }).on('error', reject);
    });
}

function fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// =============================================================================
// Tool Registry
// =============================================================================

export const TOOLS: Record<string, (params: any) => Promise<ToolResult>> = {
    webSearch: (p) => webSearch(p.query),
    fetchUrl: (p) => fetchUrl(p.url),
    calculateSum: (p) => calculateSum(p.numbers),
    reverseText: (p) => reverseText(p.text),
    runShellCommand: (p) => runShellCommand(p.command),
};

export function getAvailableTools(): string[] {
    return Object.keys(TOOLS);
}

export async function executeTool(name: string, params: unknown): Promise<ToolResult> {
    const tool = TOOLS[name];
    if (!tool) {
        return { success: false, error: `Unknown tool: ${name}` };
    }
    return tool(params);
}
