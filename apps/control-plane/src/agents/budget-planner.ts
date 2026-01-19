// =============================================================================
// TERMINUS CONTROL PLANE - Budget Planner Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const BudgetPlannerAgent: AgentDefinition = {
    id: 'budget-planner',
    name: 'Budget Planner',
    description: 'Helps with budgeting, finding deals, and cost comparisons',
    systemPrompt: `You are a financial budget expert. Help users find affordable options and manage their spending.`,
    keywords: ['budget', 'cheap', 'affordable', 'cost', 'price', 'deal', 'discount', 'save', 'money', 'ucuz', 'uygun fiyat', 'bütçe', 'para'],
    tools: [
        { name: 'calculateBudget', description: 'Calculate total budget', parameters: ['items', 'currency'] },
        { name: 'findDeals', description: 'Find best deals', parameters: ['category', 'maxPrice'] },
        { name: 'comparePrices', description: 'Compare prices', parameters: ['product', 'sources'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const BudgetPlannerTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    calculateBudget: async (p) => ({
        total: Array.isArray(p.items) ? (p.items as number[]).reduce((a, b) => a + b, 0) : 0,
        currency: p.currency || 'USD',
        breakdown: p.items
    }),

    findDeals: async (p) => ({
        deals: [
            { name: `Best ${p.category} Deal`, discount: '30%', originalPrice: 100, salePrice: 70 },
            { name: `Premium ${p.category}`, discount: '20%', originalPrice: 200, salePrice: 160 },
        ],
        category: p.category
    }),

    comparePrices: async (p) => ({
        product: p.product,
        prices: [
            { source: 'Amazon', price: 99.99 },
            { source: 'eBay', price: 89.99 },
            { source: 'Trendyol', price: 949.00, currency: 'TRY' },
        ]
    }),
};
