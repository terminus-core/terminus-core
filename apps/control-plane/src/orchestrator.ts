// =============================================================================
// TERMINUS CONTROL PLANE - Multi-Agent Orchestrator
// =============================================================================
// Main orchestrator that analyzes user intent, selects appropriate agents,
// executes them in parallel, and aggregates results.
// =============================================================================

import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import { AGENTS, formatAgentsForLLM, getAgentById, type AgentDefinition } from './agents-registry.js';
import { executeAgentTool } from './agent-tools.js';

// =============================================================================
// API Key Loading
// =============================================================================

function getApiKey(): string {
    if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY;

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

let _xai: ReturnType<typeof createXai> | null = null;
function getXai() {
    if (!_xai) {
        const key = getApiKey();
        logger.info('Orchestrator', `🔑 API Key: ${key ? key.slice(0, 10) + '...' : 'MISSING'}`);
        _xai = createXai({ apiKey: key });
    }
    return _xai;
}

// =============================================================================
// Types
// =============================================================================

export interface IntentAnalysis {
    userMessage: string;
    selectedAgents: string[];
    reasoning: string;
}

export interface AgentExecutionResult {
    agentId: string;
    agentName: string;
    toolCalls: { tool: string; params: unknown; result: unknown }[];
    summary: string;
}

export interface MultiAgentResponse {
    success: boolean;
    userMessage: string;
    agentsUsed: string[];
    agentResults: AgentExecutionResult[];
    finalResponse: string;
}

// =============================================================================
// Intent Analysis - Determines which agents to use
// =============================================================================

export async function analyzeIntent(userMessage: string): Promise<IntentAnalysis> {
    logger.info('Orchestrator', `🔍 Analyzing intent: "${userMessage.slice(0, 50)}..."`);

    try {
        const result = await generateText({
            model: getXai()('grok-4-1-fast-non-reasoning'),
            system: `You are an intent analyzer for a multi-agent system.
Given a user message, determine which agents are needed to fulfill the request.

Available agents:
${formatAgentsForLLM()}

Rules:
- Select 1-3 agents maximum
- If request spans multiple domains, select multiple agents
- Return ONLY valid JSON

Example output:
{
  "agents": ["travel-planner", "budget-planner"],
  "reasoning": "User wants to plan a trip on a budget, so we need both travel and budget expertise"
}`,
            prompt: userMessage,
        });

        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const agents = parsed.agents || [];
            logger.info('Orchestrator', `✅ Selected agents: [${agents.join(', ')}]`);
            return {
                userMessage,
                selectedAgents: agents,
                reasoning: parsed.reasoning || '',
            };
        }
    } catch (error) {
        logger.error('Orchestrator', `Intent analysis failed: ${(error as Error).message}`);
    }

    // Fallback: keyword matching
    return keywordBasedSelection(userMessage);
}

function keywordBasedSelection(message: string): IntentAnalysis {
    const lowerMessage = message.toLowerCase();
    const selected: string[] = [];

    for (const agent of AGENTS) {
        for (const keyword of agent.keywords) {
            if (lowerMessage.includes(keyword.toLowerCase())) {
                if (!selected.includes(agent.id)) {
                    selected.push(agent.id);
                }
                break;
            }
        }
    }

    // Default to travel-planner if no match
    if (selected.length === 0) {
        selected.push('travel-planner');
    }

    logger.info('Orchestrator', `🔧 Fallback selection: [${selected.join(', ')}]`);
    return {
        userMessage: message,
        selectedAgents: selected.slice(0, 3),
        reasoning: 'Keyword-based selection',
    };
}

// =============================================================================
// Agent Execution - Runs a single agent with its tools
// =============================================================================

async function executeAgent(agent: AgentDefinition, userMessage: string): Promise<AgentExecutionResult> {
    logger.info('Orchestrator', `🤖 Executing agent: ${agent.name}`);

    const toolDescriptions = agent.tools
        .map(t => `- ${t.name}(${t.parameters.join(', ')}): ${t.description}`)
        .join('\n');

    try {
        // Ask Grok to plan tool calls for this agent
        const planResult = await generateText({
            model: getXai()('grok-4-1-fast-non-reasoning'),
            system: `${agent.systemPrompt}

You have these tools:
${toolDescriptions}

Based on the user request, plan which tools to call.
Return ONLY valid JSON:
{
  "toolCalls": [
    { "tool": "toolName", "params": { "param1": "value1" } }
  ]
}`,
            prompt: userMessage,
        });

        const jsonMatch = planResult.text.match(/\{[\s\S]*\}/);
        const toolCalls: { tool: string; params: unknown; result: unknown }[] = [];

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const plannedCalls = parsed.toolCalls || [];

            // Execute each tool
            for (const call of plannedCalls) {
                const result = await executeAgentTool(agent.id, call.tool, call.params || {});
                toolCalls.push({
                    tool: call.tool,
                    params: call.params,
                    result: result.data,
                });
            }
        }

        // Generate summary
        const summaryResult = await generateText({
            model: getXai()('grok-4-1-fast-non-reasoning'),
            system: `You are ${agent.name}. Summarize the results of your tool calls for the user. Be helpful and concise.`,
            prompt: `User request: "${userMessage}"

Tool results:
${JSON.stringify(toolCalls, null, 2)}

Provide a helpful summary.`,
        });

        return {
            agentId: agent.id,
            agentName: agent.name,
            toolCalls,
            summary: summaryResult.text,
        };
    } catch (error) {
        logger.error('Orchestrator', `Agent ${agent.id} failed: ${(error as Error).message}`);
        return {
            agentId: agent.id,
            agentName: agent.name,
            toolCalls: [],
            summary: `Error: ${(error as Error).message}`,
        };
    }
}

// =============================================================================
// Multi-Agent Execution - Runs multiple agents in parallel
// =============================================================================

export async function executeMultiAgent(userMessage: string): Promise<MultiAgentResponse> {
    logger.info('Orchestrator', `🚀 Multi-agent execution for: "${userMessage.slice(0, 50)}..."`);

    // Step 1: Analyze intent
    const intent = await analyzeIntent(userMessage);

    if (intent.selectedAgents.length === 0) {
        return {
            success: false,
            userMessage,
            agentsUsed: [],
            agentResults: [],
            finalResponse: 'No suitable agents found for your request.',
        };
    }

    // Step 2: Execute agents in parallel
    const agentPromises = intent.selectedAgents.map(async (agentId) => {
        const agent = getAgentById(agentId);
        if (!agent) return null;
        return executeAgent(agent, userMessage);
    });

    const results = await Promise.all(agentPromises);
    const agentResults = results.filter((r): r is AgentExecutionResult => r !== null);

    // Step 3: Aggregate results
    const finalResponse = await aggregateResults(userMessage, agentResults);

    return {
        success: true,
        userMessage,
        agentsUsed: intent.selectedAgents,
        agentResults,
        finalResponse,
    };
}

// =============================================================================
// Result Aggregation - Combines results from multiple agents
// =============================================================================

async function aggregateResults(
    userMessage: string,
    agentResults: AgentExecutionResult[]
): Promise<string> {
    logger.info('Orchestrator', `📝 Aggregating ${agentResults.length} agent results`);

    if (agentResults.length === 1) {
        return agentResults[0].summary;
    }

    try {
        const result = await generateText({
            model: getXai()('grok-4-1-fast-non-reasoning'),
            system: `You are the main orchestrator combining results from multiple specialized agents.
Create a unified, helpful response that integrates all the information.
Be concise but comprehensive.`,
            prompt: `User asked: "${userMessage}"

Agent results:
${agentResults.map(r => `
### ${r.agentName}
${r.summary}
`).join('\n')}

Provide a unified response that combines all insights.`,
        });

        return result.text;
    } catch (error) {
        // Fallback: just concatenate summaries
        return agentResults.map(r => `**${r.agentName}:** ${r.summary}`).join('\n\n');
    }
}

// =============================================================================
// Legacy exports for backward compatibility
// =============================================================================

export interface OrchestrationPlan {
    originalPrompt: string;
    steps: { id: string; tool: string; params: Record<string, unknown>; reasoning: string }[];
    systemContext: string;
}

export async function createPlan(userPrompt: string): Promise<OrchestrationPlan> {
    // Legacy function - now just wraps multi-agent
    const intent = await analyzeIntent(userPrompt);
    return {
        originalPrompt: userPrompt,
        systemContext: intent.reasoning,
        steps: intent.selectedAgents.map((agentId, i) => ({
            id: `step-${i + 1}`,
            tool: agentId,
            params: { message: userPrompt },
            reasoning: `Use ${agentId} agent`,
        })),
    };
}

export async function summarizeResults(
    plan: OrchestrationPlan,
    results: Record<string, unknown>
): Promise<string> {
    return JSON.stringify(results);
}
