// =============================================================================
// TERMINUS CONTROL PLANE - Fitness Coach Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const FitnessCoachAgent: AgentDefinition = {
    id: 'fitness-coach',
    name: 'Fitness Coach',
    description: 'Creates workout plans and fitness advice',
    systemPrompt: `You are a fitness coach. Create workout plans and provide health and fitness guidance.`,
    keywords: ['fitness', 'workout', 'exercise', 'gym', 'weight', 'muscle', 'cardio', 'training', 'spor', 'egzersiz', 'antrenman', 'kilo'],
    tools: [
        { name: 'createWorkout', description: 'Create workout plan', parameters: ['goal', 'level', 'equipment'] },
        { name: 'calculateCalories', description: 'Calculate calories', parameters: ['activity', 'duration'] },
        { name: 'trackProgress', description: 'Track progress', parameters: ['metrics'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const FitnessCoachTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    createWorkout: async (p) => ({
        goal: p.goal,
        level: p.level,
        workout: [
            { exercise: 'Squats', sets: 3, reps: 12 },
            { exercise: 'Push-ups', sets: 3, reps: 15 },
            { exercise: 'Lunges', sets: 3, reps: 10 },
            { exercise: 'Plank', duration: '60 seconds' },
        ]
    }),

    calculateCalories: async (p) => ({
        activity: p.activity,
        duration: p.duration,
        caloriesBurned: 350
    }),

    trackProgress: async (p) => ({
        metrics: p.metrics,
        trend: 'improving',
        recommendation: 'Keep up the good work!'
    }),
};
