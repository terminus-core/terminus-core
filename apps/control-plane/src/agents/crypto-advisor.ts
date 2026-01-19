// =============================================================================
// TERMINUS CONTROL PLANE - Crypto Advisor Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const CryptoAdvisorAgent: AgentDefinition = {
    id: 'crypto-advisor',
    name: 'Crypto Advisor',
    description: 'Provides cryptocurrency analysis and advice',
    systemPrompt: `You are a cryptocurrency expert. Analyze crypto markets, tokens, and provide insights on the crypto ecosystem.`,
    keywords: ['crypto', 'bitcoin', 'ethereum', 'token', 'blockchain', 'defi', 'nft', 'coin', 'kripto', 'bitcoin', 'altcoin'],
    tools: [
        { name: 'getCryptoPrice', description: 'Get crypto price', parameters: ['symbol'] },
        { name: 'analyzeToken', description: 'Analyze token', parameters: ['address', 'chain'] },
        { name: 'getMarketCap', description: 'Get market data', parameters: ['symbol'] },
        { name: 'getDeFiStats', description: 'Get DeFi stats', parameters: ['protocol'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const CryptoAdvisorTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    getCryptoPrice: async (p) => ({
        symbol: p.symbol,
        price: p.symbol === 'BTC' ? 42500 : p.symbol === 'ETH' ? 2250 : 100,
        change24h: 3.5,
        volume24h: '25B'
    }),

    analyzeToken: async (p) => ({
        address: p.address,
        chain: p.chain,
        holders: 15000,
        liquidity: '$2.5M',
        score: 75
    }),

    getMarketCap: async (p) => ({
        symbol: p.symbol,
        marketCap: '$850B',
        rank: 1,
        dominance: '52%'
    }),

    getDeFiStats: async (p) => ({
        protocol: p.protocol,
        tvl: '$5.2B',
        apy: '8.5%',
        users: 150000
    }),
};
