// =============================================================================
// TERMINUS CONTROL PLANE - Tech Support Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const TechSupportAgent: AgentDefinition = {
    id: 'tech-support',
    name: 'Tech Support',
    description: 'Provides technical troubleshooting and solutions',
    systemPrompt: `You are a technical support specialist. Help users troubleshoot and solve technical problems.`,
    keywords: ['tech', 'computer', 'software', 'bug', 'error', 'fix', 'install', 'problem', 'issue', 'bilgisayar', 'hata', 'sorun', 'teknik'],
    tools: [
        { name: 'troubleshoot', description: 'Troubleshoot issue', parameters: ['issue', 'device'] },
        { name: 'findSolution', description: 'Find solution', parameters: ['error', 'context'] },
        { name: 'searchDocs', description: 'Search documentation', parameters: ['product', 'topic'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const TechSupportTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    troubleshoot: async (p) => ({
        issue: p.issue,
        steps: [
            'Restart your device',
            'Check for updates',
            'Clear cache and cookies',
            'Contact support if issue persists'
        ]
    }),

    findSolution: async (p) => ({
        error: p.error,
        solutions: [
            { solution: 'Reinstall the application', success: '72%' },
            { solution: 'Update drivers', success: '65%' },
        ]
    }),

    searchDocs: async (p) => ({
        product: p.product,
        articles: [
            { title: `Getting Started with ${p.product}`, url: '#' },
            { title: `${p.product} FAQ`, url: '#' },
        ]
    }),
};
