// =============================================================================
// TERMINUS CONTROL PLANE - Real Estate Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const RealEstateAgent: AgentDefinition = {
    id: 'real-estate',
    name: 'Real Estate Agent',
    description: 'Helps find properties and estimates values',
    systemPrompt: `You are a real estate expert. Help users find properties, estimate values, and understand the real estate market.`,
    keywords: ['property', 'house', 'apartment', 'rent', 'buy', 'real estate', 'mortgage', 'ev', 'daire', 'kira', 'emlak', 'satılık'],
    tools: [
        { name: 'searchProperties', description: 'Search properties', parameters: ['location', 'type', 'priceRange'] },
        { name: 'estimateValue', description: 'Estimate property value', parameters: ['address'] },
        { name: 'findAgent', description: 'Find real estate agent', parameters: ['location'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const RealEstateTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchProperties: async (p) => ({
        properties: [
            { type: p.type, location: p.location, price: 250000, bedrooms: 3 },
            { type: p.type, location: p.location, price: 180000, bedrooms: 2 },
        ]
    }),

    estimateValue: async (p) => ({
        address: p.address,
        estimatedValue: 320000,
        pricePerSqm: 4500,
        trend: 'increasing'
    }),

    findAgent: async (p) => ({
        agents: [
            { name: 'Remax Istanbul', rating: 4.5 },
            { name: 'Century 21', rating: 4.3 },
        ]
    }),
};
