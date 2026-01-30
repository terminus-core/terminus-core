import { randomUUID } from 'crypto';
import type { BaseMessage, MessageType, TerminusMessage } from './messages.js';

/**
 * Generate a unique trace ID for message correlation.
 */
export function generateTraceId(): string {
    return randomUUID();
}

/**
 * Create a base message with common fields.
 */
export function createBaseMessage(type: MessageType, traceId?: string): BaseMessage {
    return {
        type,
        traceId: traceId ?? generateTraceId(),
        timestamp: Date.now(),
    };
}

/**
 * Parse and validate an incoming message.
 * Returns null if parsing fails.
 */
export function parseMessage(data: string): TerminusMessage | null {
    try {
        const parsed = JSON.parse(data);

        // Basic validation
        if (!parsed.type || !parsed.traceId || !parsed.timestamp) {
            return null;
        }

        return parsed as TerminusMessage;
    } catch {
        return null;
    }
}

/**
 * Serialize a message for transmission.
 */
export function serializeMessage(message: TerminusMessage): string {
    return JSON.stringify(message);
}
