// =============================================================================
// TERMINUS CONTROL PLANE - Technical Analyst Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const TechnicalAnalystAgent: AgentDefinition = {
    id: 'technical-analyst',
    name: 'Technical Analyst',
    description: 'Analyzes charts and technical indicators',
    systemPrompt: `You are a technical analysis expert. Analyze price charts, patterns, and technical indicators.`,
    keywords: ['chart', 'technical', 'pattern', 'indicator', 'trend', 'resistance', 'support', 'RSI', 'MACD', 'grafik', 'teknik'],
    tools: [
        { name: 'getChartData', description: 'Get price chart', parameters: ['symbol', 'timeframe'] },
        { name: 'calculateIndicators', description: 'Calculate indicators', parameters: ['symbol', 'indicators'] },
        { name: 'detectPatterns', description: 'Detect patterns', parameters: ['symbol'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const TechnicalAnalystTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    getChartData: async (p) => ({
        symbol: p.symbol,
        timeframe: p.timeframe,
        prices: [148, 149, 151, 150, 152, 155, 153],
        trend: 'bullish'
    }),

    calculateIndicators: async (p) => ({
        symbol: p.symbol,
        indicators: {
            RSI: 62,
            MACD: { value: 1.5, signal: 1.2, histogram: 0.3 },
            SMA20: 148.5,
            SMA50: 145.2
        }
    }),

    detectPatterns: async (p) => ({
        symbol: p.symbol,
        patterns: [
            { pattern: 'Double Bottom', confidence: 0.85, signal: 'bullish' },
            { pattern: 'Rising Wedge', confidence: 0.72, signal: 'bearish' },
        ]
    }),
};
