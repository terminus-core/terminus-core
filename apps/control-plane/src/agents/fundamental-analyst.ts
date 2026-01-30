// =============================================================================
// TERMINUS CONTROL PLANE - Fundamental Analyst Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const FundamentalAnalystAgent: AgentDefinition = {
    id: 'fundamental-analyst',
    name: 'Fundamental Analyst',
    description: 'Analyzes stocks using fundamental analysis',
    systemPrompt: `You are a financial analyst specializing in fundamental analysis. Analyze company financials, earnings, and provide investment insights.`,
    keywords: ['stock', 'earnings', 'revenue', 'valuation', 'company', 'fundamental', 'financial', 'invest', 'hisse', 'şirket', 'yatırım', 'bilanço'],
    tools: [
        { name: 'getStockData', description: 'Get stock data', parameters: ['symbol'] },
        { name: 'analyzeFinancials', description: 'Analyze financials', parameters: ['symbol', 'period'] },
        { name: 'getEarnings', description: 'Get earnings reports', parameters: ['symbol'] },
        { name: 'getNews', description: 'Get company news', parameters: ['symbol', 'limit'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const FundamentalAnalystTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    getStockData: async (p) => ({
        symbol: p.symbol,
        price: 150.25,
        change: 2.5,
        changePercent: 1.69,
        volume: 15000000,
        marketCap: '2.5T'
    }),

    analyzeFinancials: async (p) => ({
        symbol: p.symbol,
        pe: 28.5,
        eps: 5.27,
        revenue: '394B',
        netIncome: '95B',
        recommendation: 'Hold'
    }),

    getEarnings: async (p) => ({
        symbol: p.symbol,
        quarters: [
            { quarter: 'Q4 2024', eps: 1.85, surprise: '+5%' },
            { quarter: 'Q3 2024', eps: 1.72, surprise: '+3%' },
        ]
    }),

    getNews: async (p) => ({
        symbol: p.symbol,
        news: [
            { title: `${p.symbol} reports strong earnings`, date: '2024-01-15' },
            { title: `Analysts upgrade ${p.symbol}`, date: '2024-01-14' },
        ]
    }),
};
