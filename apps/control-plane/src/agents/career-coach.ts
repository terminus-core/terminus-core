// =============================================================================
// TERMINUS CONTROL PLANE - Career Coach Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const CareerCoachAgent: AgentDefinition = {
    id: 'career-coach',
    name: 'Career Coach',
    description: 'Helps with job search and career development',
    systemPrompt: `You are a career coach. Help users find jobs, improve resumes, and prepare for interviews.`,
    keywords: ['job', 'career', 'resume', 'interview', 'salary', 'hire', 'work', 'profession', 'iş', 'kariyer', 'özgeçmiş', 'maaş', 'mülakat'],
    tools: [
        { name: 'searchJobs', description: 'Search jobs', parameters: ['title', 'location', 'remote'] },
        { name: 'reviewResume', description: 'Review resume', parameters: ['resumeText'] },
        { name: 'prepareInterview', description: 'Prepare interview', parameters: ['company', 'role'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const CareerCoachTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchJobs: async (p) => ({
        jobs: [
            { title: p.title, company: 'Google', location: p.location, salary: '$150K' },
            { title: p.title, company: 'Microsoft', location: p.location, salary: '$140K' },
        ]
    }),

    reviewResume: async (p) => ({
        score: 78,
        strengths: ['Clear formatting', 'Strong experience section'],
        improvements: ['Add more metrics', 'Update skills section']
    }),

    prepareInterview: async (p) => ({
        company: p.company,
        questions: [
            'Tell me about yourself',
            'Why do you want to work here?',
            'What are your strengths and weaknesses?'
        ],
        tips: ['Research the company', 'Prepare STAR examples']
    }),
};
