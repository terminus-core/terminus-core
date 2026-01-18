// =============================================================================
// TERMINUS CONTROL PLANE - LLM Orchestrator
// =============================================================================
// Uses xAI Grok to break down user requests into tool calls for nodes.
// =============================================================================

import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

// Load API key from .env file
function getApiKey(): string {
    if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY;

    // Try multiple possible locations for .env
    const paths = [
        join(process.cwd(), '.env'),
        join(process.cwd(), 'terminus-core', '.env'),
        '/Users/cansecilmis/Downloads/antigravity/terminus-root/terminus-core/.env',
    ];

    for (const envPath of paths) {
        try {
            if (existsSync(envPath)) {
                const content = readFileSync(envPath, 'utf-8');
                const match = content.match(/XAI_API_KEY=(.+)/);
                if (match) {
                    logger.info('Orchestrator', `📁 Loaded key from ${envPath}`);
                    return match[1].trim();
                }
            }
        } catch { }
    }

    return '';
}

// Lazy initialization of xAI client
let _xai: ReturnType<typeof createXai> | null = null;
function getXai() {
    if (!_xai) {
        const key = getApiKey();
        logger.info('Orchestrator', `🔑 API Key: ${key ? key.slice(0, 10) + '...' : 'MISSING'}`);
        _xai = createXai({ apiKey: key });
    }
    return _xai;
}

export interface OrchestrationPlan {
    originalPrompt: string;
    steps: OrchestrationStep[];
    systemContext: string;
}

export interface OrchestrationStep {
    id: string;
    tool: string;
    params: Record<string, unknown>;
    reasoning: string;
}

// =============================================================================
// Available Tools Description
// =============================================================================

const TOOLS_DESCRIPTION = `
Available tools:
- webSearch(query): Search the web using DuckDuckGo
- fetchUrl(url): Get content from a URL
- calculateSum(numbers): Sum an array of numbers
- reverseText(text): Reverse a string

Example response format:
{
  "reasoning": "Your thought process",
  "steps": [
    { "tool": "webSearch", "params": { "query": "Tokyo flights" }, "reasoning": "Find flight information" },
    { "tool": "fetchUrl", "params": { "url": "https://example.com" }, "reasoning": "Get detailed info" }
  ]
}
`;

// =============================================================================
// Create Plan from User Request
// =============================================================================

export async function createPlan(userPrompt: string): Promise<OrchestrationPlan> {
    logger.info('Orchestrator', `🧠 Creating plan for: "${userPrompt.slice(0, 50)}..."`);

    try {
        const result = await generateText({
            model: getXai()('grok-3-mini'),
            system: `You are an AI orchestrator for the Terminus platform.
Your job is to break down user requests into specific tool calls.
${TOOLS_DESCRIPTION}
Keep plans simple - 1-3 steps maximum.
Respond ONLY with valid JSON.`,
            prompt: userPrompt,
        });

        // Parse the response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return createSimplePlan(userPrompt);
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const steps: OrchestrationStep[] = (parsed.steps || []).map((s: any, i: number) => ({
            id: `step-${i + 1}`,
            tool: s.tool,
            params: s.params || {},
            reasoning: s.reasoning || '',
        }));

        logger.info('Orchestrator', `📋 Created plan with ${steps.length} steps`);
        steps.forEach((s, i) => {
            logger.info('Orchestrator', `   ${i + 1}. ${s.tool}(${JSON.stringify(s.params).slice(0, 40)}...)`);
        });

        return {
            originalPrompt: userPrompt,
            steps,
            systemContext: parsed.reasoning || '',
        };
    } catch (error) {
        logger.error('Orchestrator', `LLM error: ${(error as Error).message}`);
        return createSimplePlan(userPrompt);
    }
}

// Fallback simple plan when LLM fails
function createSimplePlan(userPrompt: string): OrchestrationPlan {
    return {
        originalPrompt: userPrompt,
        systemContext: 'Fallback plan - LLM unavailable',
        steps: [
            {
                id: 'step-1',
                tool: 'reverseText',
                params: { text: userPrompt },
                reasoning: 'Default action: reverse the input text',
            },
        ],
    };
}

// =============================================================================
// Combine Results
// =============================================================================

export async function summarizeResults(
    plan: OrchestrationPlan,
    results: Record<string, unknown>
): Promise<string> {
    logger.info('Orchestrator', `📝 Summarizing ${Object.keys(results).length} results`);

    try {
        const result = await generateText({
            model: getXai()('grok-3-mini'),
            system: 'Summarize the results of tool calls for the user. Be concise and helpful.',
            prompt: `Original request: "${plan.originalPrompt}"

Tool results:
${JSON.stringify(results, null, 2)}

Provide a helpful summary response.`,
        });

        return result.text;
    } catch (error) {
        logger.error('Orchestrator', `Summary error: ${(error as Error).message}`);
        return JSON.stringify(results);
    }
}
