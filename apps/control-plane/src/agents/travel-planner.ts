// =============================================================================
// TERMINUS CONTROL PLANE - Travel Planner Agent
// =============================================================================

import type { AgentDefinition, ToolParams } from './types.js';

// =============================================================================
// Agent Definition
// =============================================================================

export const TravelPlannerAgent: AgentDefinition = {
    id: 'travel-planner',
    name: 'Travel Planner',
    description: 'Plans trips, finds flights and hotels, provides travel advice',
    systemPrompt: `You are a travel planning expert. Help users plan trips by searching for flights, hotels, and providing destination information.`,
    keywords: ['travel', 'trip', 'flight', 'hotel', 'vacation', 'holiday', 'tourism', 'destination', 'seyahat', 'uçuş', 'otel', 'tatil'],
    tools: [
        { name: 'searchFlights', description: 'Search for flights', parameters: ['origin', 'destination', 'date'] },
        { name: 'searchHotels', description: 'Search for hotels', parameters: ['location', 'checkIn', 'checkOut'] },
        { name: 'getWeather', description: 'Get weather forecast', parameters: ['location', 'days'] },
        { name: 'getAttractions', description: 'Find attractions', parameters: ['location', 'type'] },
    ],
};

// =============================================================================
// Tool Implementations
// =============================================================================

export const TravelPlannerTools: Record<string, (params: ToolParams) => Promise<unknown>> = {
    searchFlights: async (p) => ({
        flights: [
            { airline: 'Turkish Airlines', price: 450, departure: '08:00', arrival: '14:30' },
            { airline: 'Pegasus', price: 320, departure: '11:00', arrival: '17:30' },
            { airline: 'Emirates', price: 680, departure: '23:00', arrival: '06:30' },
        ],
        query: { from: p.origin, to: p.destination, date: p.date }
    }),

    searchHotels: async (p) => ({
        hotels: [
            { name: 'Grand Hyatt', rating: 5, price: 250, location: p.location },
            { name: 'Holiday Inn', rating: 4, price: 120, location: p.location },
            { name: 'Airbnb Apartment', rating: 4.5, price: 85, location: p.location },
        ]
    }),

    getWeather: async (p) => ({
        location: p.location,
        forecast: [
            { day: 'Today', temp: 22, condition: 'Sunny' },
            { day: 'Tomorrow', temp: 20, condition: 'Partly Cloudy' },
            { day: 'Day 3', temp: 18, condition: 'Rain' },
        ]
    }),

    getAttractions: async (p) => ({
        attractions: [
            { name: 'Tokyo Tower', type: 'landmark', rating: 4.5 },
            { name: 'Senso-ji Temple', type: 'temple', rating: 4.8 },
            { name: 'Shibuya Crossing', type: 'attraction', rating: 4.3 },
        ]
    }),
};
