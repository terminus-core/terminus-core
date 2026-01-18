// =============================================================================
// TERMINUS PROTOCOL - Message Types
// =============================================================================
// These are the messages exchanged between Control Plane and Agent Nodes.
// All communication flows through these well-defined schemas.
// =============================================================================

export type MessageType =
    | 'AUTH'
    | 'AUTH_ACK'
    | 'HEARTBEAT'
    | 'HEARTBEAT_ACK'
    | 'JOB_ASSIGN'
    | 'JOB_RESULT'
    | 'ERROR';

// -----------------------------------------------------------------------------
// Base Message
// -----------------------------------------------------------------------------

export interface BaseMessage {
    type: MessageType;
    traceId: string;
    timestamp: number;
}

// -----------------------------------------------------------------------------
// Authentication Messages
// -----------------------------------------------------------------------------

/**
 * Node → Backend: First message after connection.
 * Node introduces itself and proves ownership.
 */
export interface AuthMessage extends BaseMessage {
    type: 'AUTH';
    payload: {
        nodeId: string;              // Unique node identifier (UUID for now, wallet address later)
        capabilities: string[];       // ['python-3.10', 'docker', 'nvidia-gpu']
        specs: {                      // Machine specifications
            os: string;
            arch: string;
            cpuCores: number;
            totalMemoryGB: number;
            nodeVersion: string;
        };
        secret: string;              // Simple secret for now, signature later
        version: string;             // Node runtime version
    };
}

/**
 * Backend → Node: Authentication acknowledgment.
 */
export interface AuthAckMessage extends BaseMessage {
    type: 'AUTH_ACK';
    payload: {
        success: boolean;
        message?: string;
        heartbeatInterval?: number;  // How often to send heartbeats (ms)
    };
}

// -----------------------------------------------------------------------------
// Heartbeat Messages
// -----------------------------------------------------------------------------

export type NodeStatus = 'IDLE' | 'BUSY' | 'DRAINING';

/**
 * Node → Backend: Periodic alive signal with status.
 */
export interface HeartbeatMessage extends BaseMessage {
    type: 'HEARTBEAT';
    payload: {
        status: NodeStatus;
        cpuUsage: number;            // 0-100 percentage
        memoryUsage: number;         // 0-100 percentage
        activeJobs: number;          // Number of currently running jobs
    };
}

/**
 * Backend → Node: Heartbeat acknowledgment.
 */
export interface HeartbeatAckMessage extends BaseMessage {
    type: 'HEARTBEAT_ACK';
    payload: {
        received: boolean;
    };
}

// -----------------------------------------------------------------------------
// Job Messages
// -----------------------------------------------------------------------------

/**
 * Backend → Node: Assign a job to execute.
 */
export interface JobAssignMessage extends BaseMessage {
    type: 'JOB_ASSIGN';
    payload: {
        jobId: string;
        agentId: string;
        runId: string;
        input: unknown;
        timeout?: number;            // Max execution time (ms)
    };
}

/**
 * Node → Backend: Job execution result.
 */
export interface JobResultMessage extends BaseMessage {
    type: 'JOB_RESULT';
    payload: {
        jobId: string;
        runId: string;
        status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
        output?: unknown;
        logs: string[];               // Captured console.log outputs from sandbox
        error?: {
            code: string;
            message: string;
            stack?: string;
        };
        metrics: {
            startTime: number;
            endTime: number;
            durationMs: number;
        };
    };
}

// -----------------------------------------------------------------------------
// Error Messages
// -----------------------------------------------------------------------------

/**
 * Bidirectional: Error notification.
 */
export interface ErrorMessage extends BaseMessage {
    type: 'ERROR';
    payload: {
        code: string;
        message: string;
        fatal: boolean;              // If true, connection will be terminated
    };
}

// -----------------------------------------------------------------------------
// Union Type
// -----------------------------------------------------------------------------

export type TerminusMessage =
    | AuthMessage
    | AuthAckMessage
    | HeartbeatMessage
    | HeartbeatAckMessage
    | JobAssignMessage
    | JobResultMessage
    | ErrorMessage;
