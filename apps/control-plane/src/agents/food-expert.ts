// =============================================================================
// TERMINUS CONTROL PLANE - Food Expert Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const FoodExpertAgent: AgentDefinition = {
    id: 'food-expert',
    name: 'Food Expert',
    description: 'Recommends restaurants and provides recipes',
    systemPrompt: `You are a food and restaurant expert. Help users find great places to eat and provide recipe suggestions.`,
    keywords: ['food', 'restaurant', 'recipe', 'cook', 'eat', 'cuisine', 'delivery', 'meal', 'yemek', 'restoran', 'tarif', 'mutfak'],
    tools: [
        { name: 'searchRestaurants', description: 'Find restaurants', parameters: ['location', 'cuisine', 'priceRange'] },
        { name: 'getRecipes', description: 'Get recipes', parameters: ['dish', 'diet'] },
        { name: 'findDelivery', description: 'Find delivery options', parameters: ['location', 'cuisine'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const FoodExpertTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchRestaurants: async (p) => ({
        restaurants: [
            { name: 'Nusret', cuisine: p.cuisine || 'Steakhouse', rating: 4.5, priceRange: '$$$' },
            { name: 'Mikla', cuisine: 'Turkish', rating: 4.8, priceRange: '$$$$' },
            { name: 'Karaköy Lokantası', cuisine: 'Traditional', rating: 4.6, priceRange: '$$' },
        ]
    }),

    getRecipes: async (p) => ({
        dish: p.dish,
        recipes: [
            { name: `Classic ${p.dish}`, time: '30 min', difficulty: 'Easy' },
            { name: `Gourmet ${p.dish}`, time: '60 min', difficulty: 'Medium' },
        ]
    }),

    findDelivery: async (p) => ({
        options: [
            { service: 'Yemeksepeti', deliveryTime: '30-45 min', fee: 15 },
            { service: 'Getir Yemek', deliveryTime: '20-30 min', fee: 10 },
        ]
    }),
};
