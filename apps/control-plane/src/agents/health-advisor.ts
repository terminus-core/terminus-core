// =============================================================================
// TERMINUS CONTROL PLANE - Health Advisor Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const HealthAdvisorAgent: AgentDefinition = {
    id: 'health-advisor',
    name: 'Health Advisor',
    description: 'Provides health advice, finds doctors and medical facilities',
    systemPrompt: `You are a health advisor. Help users find medical professionals and provide general health guidance. Always recommend consulting a real doctor for serious issues.`,
    keywords: ['health', 'doctor', 'hospital', 'medical', 'symptom', 'medicine', 'pharmacy', 'sick', 'illness', 'sağlık', 'doktor', 'hastane', 'ilaç', 'hasta'],
    tools: [
        { name: 'searchDoctors', description: 'Find doctors', parameters: ['specialty', 'location'] },
        { name: 'checkSymptoms', description: 'Check symptoms', parameters: ['symptoms'] },
        { name: 'findPharmacy', description: 'Find pharmacies', parameters: ['location', 'medicine'] },
        { name: 'findHospitals', description: 'Find hospitals', parameters: ['location', 'emergency'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const HealthAdvisorTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchDoctors: async (p) => ({
        doctors: [
            { name: 'Dr. Ahmet Yılmaz', specialty: p.specialty, rating: 4.8, location: p.location },
            { name: 'Dr. Ayşe Kaya', specialty: p.specialty, rating: 4.6, location: p.location },
            { name: 'Dr. Mehmet Demir', specialty: p.specialty, rating: 4.9, location: p.location },
        ]
    }),

    checkSymptoms: async (p) => ({
        symptoms: p.symptoms,
        possibleConditions: [
            { condition: 'Common Cold', probability: 'high', recommendation: 'Rest and fluids' },
            { condition: 'Flu', probability: 'medium', recommendation: 'See a doctor if symptoms worsen' },
        ],
        disclaimer: 'This is not medical advice. Please consult a healthcare professional.'
    }),

    findPharmacy: async (p) => ({
        pharmacies: [
            { name: '24/7 Pharmacy', distance: '0.5 km', open: true },
            { name: 'City Pharmacy', distance: '1.2 km', open: true },
        ],
        medicine: p.medicine
    }),

    findHospitals: async (p) => ({
        hospitals: [
            { name: 'City Hospital', distance: '2 km', emergency: true },
            { name: 'University Hospital', distance: '5 km', emergency: true },
        ]
    }),
};
