// =============================================================================
// TERMINUS CONTROL PLANE - Shopping Assistant Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const ShoppingAssistantAgent: AgentDefinition = {
    id: 'shopping-assistant',
    name: 'Shopping Assistant',
    description: 'Helps find products and compare prices',
    systemPrompt: `You are a shopping assistant. Help users find products, compare prices, and find the best deals.`,
    keywords: ['shop', 'buy', 'product', 'amazon', 'online', 'purchase', 'order', 'sale', 'alışveriş', 'ürün', 'satın', 'kampanya'],
    tools: [
        { name: 'searchProducts', description: 'Search products', parameters: ['query', 'category'] },
        { name: 'comparePrices', description: 'Compare prices', parameters: ['product'] },
        { name: 'findCoupons', description: 'Find coupons', parameters: ['store'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const ShoppingAssistantTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchProducts: async (p) => ({
        products: [
            { name: `${p.query} Pro`, price: 299, rating: 4.5, seller: 'Amazon' },
            { name: `${p.query} Basic`, price: 149, rating: 4.2, seller: 'Trendyol' },
        ]
    }),

    findCoupons: async (p) => ({
        store: p.store,
        coupons: [
            { code: 'SAVE20', discount: '20% off' },
            { code: 'FREESHIP', discount: 'Free shipping' },
        ]
    }),
};
