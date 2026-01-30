// =============================================================================
// TERMINUS CONTROL PLANE - Agent Store
// =============================================================================
// In-memory storage for agents and their state.
// =============================================================================

import { randomUUID } from 'crypto';

export interface Agent {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    script: string;
    capabilities: string[];
    createdAt: number;
    updatedAt: number;
}

export interface AgentState {
    agentId: string;
    memory: Record<string, unknown>;
    lastUpdated: number;
}

// In-memory stores
const agents = new Map<string, Agent>();
const agentStates = new Map<string, AgentState>();

// =============================================================================
// Agent CRUD
// =============================================================================

export function createAgent(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const agent: Agent = {
        id: `agent-${randomUUID().slice(0, 8)}`,
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    agents.set(agent.id, agent);
    return agent;
}

export function getAgent(id: string): Agent | undefined {
    return agents.get(id);
}

export function getAllAgents(): Agent[] {
    return Array.from(agents.values());
}

export function updateAgent(id: string, data: Partial<Agent>): Agent | undefined {
    const agent = agents.get(id);
    if (!agent) return undefined;

    const updated = { ...agent, ...data, updatedAt: Date.now() };
    agents.set(id, updated);
    return updated;
}

export function deleteAgent(id: string): boolean {
    agentStates.delete(id);
    return agents.delete(id);
}

// =============================================================================
// Agent State (Memory)
// =============================================================================

export function getAgentState(agentId: string): AgentState {
    let state = agentStates.get(agentId);
    if (!state) {
        state = { agentId, memory: {}, lastUpdated: Date.now() };
        agentStates.set(agentId, state);
    }
    return state;
}

export function updateAgentState(agentId: string, memory: Record<string, unknown>): AgentState {
    const state: AgentState = {
        agentId,
        memory,
        lastUpdated: Date.now(),
    };
    agentStates.set(agentId, state);
    return state;
}

// =============================================================================
// Initialize Default Agent
// =============================================================================

const DEFAULT_SCRIPT = `
(function(input, memory) {
  // Initialize visited places array if not exists
  if (!memory.visitedPlaces) {
    memory.visitedPlaces = [];
  }
  
  console.log('[TravelAgent] Current memory:', JSON.stringify(memory));
  
  // Add new place to memory
  if (input.place) {
    memory.visitedPlaces.push(input.place);
    console.log('[TravelAgent] Added:', input.place);
  }
  
  return {
    message: 'Registered your travel!',
    visitedPlaces: memory.visitedPlaces,
    totalPlaces: memory.visitedPlaces.length
  };
})(input, memory);
`;

// Create default travel agent on startup
createAgent({
    name: 'TravelAgent',
    description: 'Tracks places you have visited',
    systemPrompt: 'You are a friendly travel assistant that remembers places.',
    script: DEFAULT_SCRIPT,
    capabilities: ['travel-planner'],
});
