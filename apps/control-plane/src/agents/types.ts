// =============================================================================
// TERMINUS CONTROL PLANE - Agent Types
// =============================================================================

export type ToolParams = Record<string, unknown>;
export type ToolResult = { success: boolean; data: unknown };

export interface AgentTool {
    name: string;
    description: string;
    parameters: string[];
}

export interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    tools: AgentTool[];
    keywords: string[];
}

export type ToolImplementation = (params: ToolParams) => Promise<unknown>;
export type ToolRegistry = Record<string, ToolImplementation>;
