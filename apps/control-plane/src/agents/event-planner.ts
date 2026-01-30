// =============================================================================
// TERMINUS CONTROL PLANE - Event Planner Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const EventPlannerAgent: AgentDefinition = {
    id: 'event-planner',
    name: 'Event Planner',
    description: 'Plans events and finds venues',
    systemPrompt: `You are an event planning expert. Help users plan and organize events of all types.`,
    keywords: ['event', 'party', 'wedding', 'venue', 'conference', 'meeting', 'celebration', 'etkinlik', 'düğün', 'parti', 'mekan', 'toplantı'],
    tools: [
        { name: 'searchVenues', description: 'Find venues', parameters: ['location', 'capacity', 'type'] },
        { name: 'findCaterer', description: 'Find catering', parameters: ['location', 'cuisine', 'headcount'] },
        { name: 'bookTickets', description: 'Book tickets', parameters: ['event', 'quantity'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const EventPlannerTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchVenues: async (p) => ({
        venues: [
            { name: 'Grand Ballroom', capacity: p.capacity, price: 5000 },
            { name: 'Rooftop Terrace', capacity: p.capacity, price: 3500 },
        ]
    }),

    findCaterer: async (p) => ({
        caterers: [
            { name: 'Gourmet Events', pricePerPerson: 85 },
            { name: 'Catering Plus', pricePerPerson: 65 },
        ]
    }),

    bookTickets: async (p) => ({
        event: p.event,
        tickets: p.quantity,
        total: (p.quantity as number) * 50,
        confirmation: 'TICKET-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    }),
};
