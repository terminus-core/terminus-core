// =============================================================================
// TERMINUS CONTROL PLANE - Agent Registry (Re-export from agents/)
// =============================================================================
// This file re-exports from agents/ for backward compatibility.
// All agent definitions are now in individual files under agents/
// =============================================================================

export {
    AGENTS,
    getAgentById,
    getAllAgentIds,
    getAgentToolNames,
    formatAgentsForLLM,
    type AgentDefinition,
    type AgentTool,
} from './agents/index.js';
