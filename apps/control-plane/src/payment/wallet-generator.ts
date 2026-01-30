// =============================================================================
// TERMINUS CONTROL PLANE - Agent Wallet Generator
// =============================================================================
// Creates deterministic wallets for each agent.
// Private keys are ONLY stored in .env for the orchestrator.
// Agent private keys are derived but NOT stored - agents manage their own keys.
// =============================================================================

import { ethers } from 'ethers';
import { logger } from '../logger.js';

export interface AgentWallet {
    agentId: string;
    address: string;
    totalEarnings: number;
    pendingBalance: number;
}

// In-memory registry
const walletRegistry = new Map<string, AgentWallet>();

// Master seed for deterministic wallet generation
// This is public - anyone can derive the same addresses
const MASTER_SEED = 'terminus-agent-wallet-seed-v1';

// =============================================================================
// Wallet Generation (PUBLIC - no secrets)
// =============================================================================

function generateAddressFromAgentId(agentId: string): string {
    // Create deterministic wallet from agent ID
    // NOTE: This derives a PUBLIC address only - no private key storage
    const seed = `${MASTER_SEED}-${agentId}`;
    const hash = ethers.id(seed);  // keccak256 hash
    const wallet = new ethers.Wallet(hash);
    return wallet.address;
}

// =============================================================================
// Registry Operations
// =============================================================================

export function getOrCreateAgentWallet(agentId: string): AgentWallet {
    let wallet = walletRegistry.get(agentId);

    if (!wallet) {
        const address = generateAddressFromAgentId(agentId);
        wallet = {
            agentId,
            address,
            totalEarnings: 0,
            pendingBalance: 0,
        };
        walletRegistry.set(agentId, wallet);
        logger.info('WalletGen', `💳 Generated address for ${agentId}: ${address.slice(0, 10)}...`);
    }

    return wallet;
}

export function getAgentAddress(agentId: string): string {
    return getOrCreateAgentWallet(agentId).address;
}

export function creditAgent(agentId: string, amountUSDC: number): void {
    const wallet = getOrCreateAgentWallet(agentId);
    wallet.totalEarnings += amountUSDC;
    wallet.pendingBalance += amountUSDC;
    logger.info('WalletGen', `💵 ${agentId}: +$${amountUSDC.toFixed(4)} (Total: $${wallet.totalEarnings.toFixed(4)})`);
}

export function getAllAgentWallets(): AgentWallet[] {
    return Array.from(walletRegistry.values());
}

export function getWalletStats(): {
    totalEarnings: number;
    agentCount: number;
    wallets: { agentId: string; address: string; earnings: number }[]
} {
    const wallets = getAllAgentWallets();
    return {
        totalEarnings: wallets.reduce((sum, w) => sum + w.totalEarnings, 0),
        agentCount: wallets.length,
        wallets: wallets.map(w => ({
            agentId: w.agentId,
            address: w.address,
            earnings: w.totalEarnings,
        })),
    };
}

// =============================================================================
// Initialize wallets for all 15 agents
// =============================================================================

const AGENT_IDS = [
    'travel-planner', 'budget-planner', 'health-advisor', 'fundamental-analyst',
    'technical-analyst', 'crypto-advisor', 'food-expert', 'fitness-coach',
    'legal-advisor', 'real-estate', 'career-coach', 'event-planner',
    'tech-support', 'shopping-assistant', 'language-tutor',
];

export function initializeAllAgentWallets(): void {
    logger.info('WalletGen', '🔐 Initializing agent wallets...');
    for (const agentId of AGENT_IDS) {
        getOrCreateAgentWallet(agentId);
    }
    logger.info('WalletGen', `✅ ${AGENT_IDS.length} agent wallets ready`);
}

// Auto-initialize on import
initializeAllAgentWallets();
