// =============================================================================
// TERMINUS CONTROL PLANE - Agents Index
// =============================================================================
// Central registry for all agents and their tools.
// Each agent is in its own file for modularity.
// =============================================================================

import { logger } from '../logger.js';

// Types
export type { AgentDefinition, AgentTool, ToolParams, ToolResult, ToolImplementation, ToolRegistry } from './types.js';

// Agent Imports
import { TravelPlannerAgent, TravelPlannerTools } from './travel-planner.js';
import { BudgetPlannerAgent, BudgetPlannerTools } from './budget-planner.js';
import { HealthAdvisorAgent, HealthAdvisorTools } from './health-advisor.js';
import { FundamentalAnalystAgent, FundamentalAnalystTools } from './fundamental-analyst.js';
import { TechnicalAnalystAgent, TechnicalAnalystTools } from './technical-analyst.js';
import { CryptoAdvisorAgent, CryptoAdvisorTools } from './crypto-advisor.js';
import { FoodExpertAgent, FoodExpertTools } from './food-expert.js';
import { FitnessCoachAgent, FitnessCoachTools } from './fitness-coach.js';
import { LegalAdvisorAgent, LegalAdvisorTools } from './legal-advisor.js';
import { RealEstateAgent, RealEstateTools } from './real-estate.js';
import { CareerCoachAgent, CareerCoachTools } from './career-coach.js';
import { EventPlannerAgent, EventPlannerTools } from './event-planner.js';
import { TechSupportAgent, TechSupportTools } from './tech-support.js';
import { ShoppingAssistantAgent, ShoppingAssistantTools } from './shopping-assistant.js';
import { LanguageTutorAgent, LanguageTutorTools } from './language-tutor.js';

import type { AgentDefinition, ToolParams, ToolResult } from './types.js';

// =============================================================================
// All Agents Registry
// =============================================================================

export const AGENTS: AgentDefinition[] = [
    TravelPlannerAgent,
    BudgetPlannerAgent,
    HealthAdvisorAgent,
    FundamentalAnalystAgent,
    TechnicalAnalystAgent,
    CryptoAdvisorAgent,
    FoodExpertAgent,
    FitnessCoachAgent,
    LegalAdvisorAgent,
    RealEstateAgent,
    CareerCoachAgent,
    EventPlannerAgent,
    TechSupportAgent,
    ShoppingAssistantAgent,
    LanguageTutorAgent,
];

// =============================================================================
// All Tools Registry
// =============================================================================

const ALL_TOOLS: Record<string, (params: ToolParams) => Promise<unknown>> = {
    ...TravelPlannerTools,
    ...BudgetPlannerTools,
    ...HealthAdvisorTools,
    ...FundamentalAnalystTools,
    ...TechnicalAnalystTools,
    ...CryptoAdvisorTools,
    ...FoodExpertTools,
    ...FitnessCoachTools,
    ...LegalAdvisorTools,
    ...RealEstateTools,
    ...CareerCoachTools,
    ...EventPlannerTools,
    ...TechSupportTools,
    ...ShoppingAssistantTools,
    ...LanguageTutorTools,
};

// =============================================================================
// Tool Executor
// =============================================================================

export async function executeAgentTool(
    agentId: string,
    toolName: string,
    params: ToolParams
): Promise<ToolResult> {
    logger.info('AgentTools', `🔧 ${agentId}.${toolName}(${JSON.stringify(params).slice(0, 50)}...)`);

    const toolFn = ALL_TOOLS[toolName];
    if (!toolFn) {
        return { success: false, data: { error: `Unknown tool: ${toolName}` } };
    }

    try {
        const result = await toolFn(params);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, data: { error: (error as Error).message } };
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getAgentById(id: string): AgentDefinition | undefined {
    return AGENTS.find(a => a.id === id);
}

export function getAllAgentIds(): string[] {
    return AGENTS.map(a => a.id);
}

export function getAgentToolNames(agentId: string): string[] {
    const agent = getAgentById(agentId);
    return agent ? agent.tools.map(t => t.name) : [];
}

export function formatAgentsForLLM(): string {
    return AGENTS.map(a =>
        `- ${a.id}: ${a.description} (tools: ${a.tools.map(t => t.name).join(', ')})`
    ).join('\n');
}

// Re-export individual agents for direct access
export {
    TravelPlannerAgent,
    BudgetPlannerAgent,
    HealthAdvisorAgent,
    FundamentalAnalystAgent,
    TechnicalAnalystAgent,
    CryptoAdvisorAgent,
    FoodExpertAgent,
    FitnessCoachAgent,
    LegalAdvisorAgent,
    RealEstateAgent,
    CareerCoachAgent,
    EventPlannerAgent,
    TechSupportAgent,
    ShoppingAssistantAgent,
    LanguageTutorAgent,
};
