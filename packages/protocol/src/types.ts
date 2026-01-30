// =============================================================================
// TERMINUS PROTOCOL - Common Types
// =============================================================================

/**
 * Registered node information stored in the registry.
 */
export interface RegisteredNode {
    nodeId: string;
    capabilities: string[];
    agentTypes?: string[];           // Agents this node can execute (e.g., ['travel-planner'])
    wallet?: string;                 // Wallet address for payments
    version: string;
    status: 'ONLINE' | 'OFFLINE';
    connectedAt: number;
    lastHeartbeat: number;
    metrics: {
        cpuUsage: number;
        memoryUsage: number;
        activeJobs: number;
    };
}

/**
 * Agent definition from the registry.
 */
export interface AgentDefinition {
    agentId: string;
    name: string;
    description: string;
    capabilities: string[];
    pricing?: {
        model: 'FREE' | 'PER_CALL' | 'PER_TOKEN';
        amount?: number;
        currency?: string;
    };
}

/**
 * Run state - execution instance of an agent.
 */
export interface RunState {
    runId: string;
    agentId: string;
    nodeId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
    input: unknown;
    output?: unknown;
    error?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}

/**
 * Event log entry for a run.
 */
export interface RunEvent {
    runId: string;
    eventId: string;
    type: 'INPUT' | 'STEP' | 'LOG' | 'OUTPUT' | 'ERROR' | 'RETRY';
    timestamp: number;
    data: unknown;
}
