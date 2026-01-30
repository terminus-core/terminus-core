// =============================================================================
// TERMINUS CONTROL PLANE - Language Tutor Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const LanguageTutorAgent: AgentDefinition = {
    id: 'language-tutor',
    name: 'Language Tutor',
    description: 'Helps learn languages and translate text',
    systemPrompt: `You are a language tutor. Help users learn languages, translate text, and practice conversation.`,
    keywords: ['language', 'translate', 'english', 'spanish', 'learn', 'grammar', 'vocabulary', 'dil', 'çeviri', 'ingilizce', 'öğren'],
    tools: [
        { name: 'translate', description: 'Translate text', parameters: ['text', 'from', 'to'] },
        { name: 'explainGrammar', description: 'Explain grammar', parameters: ['topic', 'language'] },
        { name: 'practiceConversation', description: 'Practice conversation', parameters: ['scenario', 'language'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const LanguageTutorTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    translate: async (p) => ({
        original: p.text,
        translated: `[Translated from ${p.from} to ${p.to}]: ${p.text}`,
        from: p.from,
        to: p.to
    }),

    explainGrammar: async (p) => ({
        topic: p.topic,
        language: p.language,
        explanation: `In ${p.language}, ${p.topic} works like this...`,
        examples: ['Example 1', 'Example 2']
    }),

    practiceConversation: async (p) => ({
        scenario: p.scenario,
        language: p.language,
        dialogue: `Let's practice a ${p.scenario} conversation in ${p.language}!`,
        phrases: ['Hello, how can I help you?', 'I would like to...']
    }),
};
