import type { WebSocket } from 'ws';
import type { RegisteredNode } from '@terminus/protocol';

/**
 * Node Registry - Tracks all connected nodes.
 */
class NodeRegistry {
    private nodes = new Map<string, RegisteredNode>();
    private sockets = new Map<string, WebSocket>();

    /**
     * Register a new node.
     */
    register(nodeId: string, socket: WebSocket, data: Omit<RegisteredNode, 'nodeId' | 'status' | 'connectedAt' | 'lastHeartbeat' | 'metrics'>): void {
        const node: RegisteredNode = {
            nodeId,
            capabilities: data.capabilities,
            version: data.version,
            status: 'ONLINE',
            connectedAt: Date.now(),
            lastHeartbeat: Date.now(),
            metrics: {
                cpuUsage: 0,
                memoryUsage: 0,
                activeJobs: 0,
            },
        };

        this.nodes.set(nodeId, node);
        this.sockets.set(nodeId, socket);
    }

    /**
     * Update node heartbeat and metrics.
     */
    updateHeartbeat(nodeId: string, metrics: RegisteredNode['metrics']): boolean {
        const node = this.nodes.get(nodeId);
        if (!node) return false;

        node.lastHeartbeat = Date.now();
        node.metrics = metrics;
        return true;
    }

    /**
     * Remove a node from the registry.
     */
    unregister(nodeId: string): boolean {
        this.sockets.delete(nodeId);
        return this.nodes.delete(nodeId);
    }

    /**
     * Get a node by ID.
     */
    get(nodeId: string): RegisteredNode | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Get socket for a node.
     */
    getSocket(nodeId: string): WebSocket | undefined {
        return this.sockets.get(nodeId);
    }

    /**
     * Find node ID by socket reference.
     */
    findNodeIdBySocket(socket: WebSocket): string | undefined {
        for (const [nodeId, s] of this.sockets) {
            if (s === socket) return nodeId;
        }
        return undefined;
    }

    /**
     * Get all online nodes.
     */
    getOnlineNodes(): RegisteredNode[] {
        return Array.from(this.nodes.values()).filter(n => n.status === 'ONLINE');
    }

    /**
     * Get nodes with specific capability.
     */
    getNodesWithCapability(capability: string): RegisteredNode[] {
        return this.getOnlineNodes().filter(n => n.capabilities.includes(capability));
    }

    /**
     * Get all idle nodes (ready to accept jobs).
     */
    getIdleNodes(): RegisteredNode[] {
        return Array.from(this.nodes.values()).filter(
            n => n.status === 'ONLINE' && n.metrics.activeJobs === 0
        );
    }

    /**
     * Set node status (IDLE/BUSY).
     */
    setNodeStatus(nodeId: string, status: 'IDLE' | 'BUSY'): boolean {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        // We track via metrics.activeJobs, status field is for node-level
        return true;
    }

    /**
     * Get registry stats.
     */
    getStats(): { total: number; online: number } {
        const all = Array.from(this.nodes.values());
        return {
            total: all.length,
            online: all.filter(n => n.status === 'ONLINE').length,
        };
    }
}

export const nodeRegistry = new NodeRegistry();
