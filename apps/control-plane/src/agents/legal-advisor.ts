// =============================================================================
// TERMINUS CONTROL PLANE - Legal Advisor Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const LegalAdvisorAgent: AgentDefinition = {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    description: 'Provides legal information and finds lawyers',
    systemPrompt: `You are a legal information assistant. Provide general legal guidance and help find legal professionals. Always recommend consulting a real lawyer for serious matters.`,
    keywords: ['legal', 'law', 'lawyer', 'attorney', 'contract', 'court', 'rights', 'sue', 'hukuk', 'avukat', 'dava', 'sözleşme'],
    tools: [
        { name: 'searchLaws', description: 'Search laws', parameters: ['topic', 'jurisdiction'] },
        { name: 'findLawyer', description: 'Find lawyers', parameters: ['specialty', 'location'] },
        { name: 'analyzeContract', description: 'Analyze contract', parameters: ['contractText'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const LegalAdvisorTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchLaws: async (p) => ({
        topic: p.topic,
        laws: [
            { name: 'Consumer Protection Act', relevance: 'high' },
            { name: 'Civil Code Article 25', relevance: 'medium' },
        ],
        disclaimer: 'Consult a licensed attorney for legal advice.'
    }),

    findLawyer: async (p) => ({
        lawyers: [
            { name: 'Av. Ali Veli', specialty: p.specialty, rating: 4.7 },
            { name: 'Av. Fatma Yıldız', specialty: p.specialty, rating: 4.9 },
        ]
    }),

    analyzeContract: async (p) => ({
        summary: 'Standard service agreement',
        risks: ['Automatic renewal clause', 'Limited liability section'],
        recommendation: 'Review sections 3 and 7 carefully'
    }),
};
