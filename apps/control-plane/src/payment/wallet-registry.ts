// =============================================================================
// TERMINUS CONTROL PLANE - Agent Wallet Registry
// =============================================================================
// Maps agents to their wallet addresses for payment distribution.
// In production, agents register their own wallets upon connection.
// =============================================================================

import { logger } from '../logger.js';

export interface AgentWallet {
    agentId: string;
    walletAddress: string;
    totalEarnings: number;  // Cumulative USDC earned
    pendingBalance: number; // Unsettled balance
}

// In-memory wallet registry (production: use database)
const walletRegistry = new Map<string, AgentWallet>();

// Default testnet wallets (for demo purposes)
// In production, agents register their own addresses
const DEFAULT_TESTNET_WALLETS: Record<string, string> = {
    'travel-planner': '0x1111111111111111111111111111111111111001',
    'budget-planner': '0x1111111111111111111111111111111111111002',
    'health-advisor': '0x1111111111111111111111111111111111111003',
    'fundamental-analyst': '0x1111111111111111111111111111111111111004',
    'technical-analyst': '0x1111111111111111111111111111111111111005',
    'crypto-advisor': '0x1111111111111111111111111111111111111006',
    'food-expert': '0x1111111111111111111111111111111111111007',
    'fitness-coach': '0x1111111111111111111111111111111111111008',
    'legal-advisor': '0x1111111111111111111111111111111111111009',
    'real-estate': '0x1111111111111111111111111111111111111010',
    'career-coach': '0x1111111111111111111111111111111111111011',
    'event-planner': '0x1111111111111111111111111111111111111012',
    'tech-support': '0x1111111111111111111111111111111111111013',
    'shopping-assistant': '0x1111111111111111111111111111111111111014',
    'language-tutor': '0x1111111111111111111111111111111111111015',
};

// =============================================================================
// Registry Operations
// =============================================================================

export function registerAgentWallet(agentId: string, walletAddress: string): AgentWallet {
    const wallet: AgentWallet = {
        agentId,
        walletAddress,
        totalEarnings: 0,
        pendingBalance: 0,
    };
    walletRegistry.set(agentId, wallet);
    logger.info('WalletRegistry', `💳 Registered wallet for ${agentId}: ${walletAddress.slice(0, 10)}...`);
    return wallet;
}

export function getAgentWallet(agentId: string): AgentWallet | undefined {
    // Check registry first
    let wallet = walletRegistry.get(agentId);

    // Fallback to default testnet wallet
    if (!wallet && DEFAULT_TESTNET_WALLETS[agentId]) {
        wallet = registerAgentWallet(agentId, DEFAULT_TESTNET_WALLETS[agentId]);
    }

    return wallet;
}

export function getAgentWalletAddress(agentId: string): string | undefined {
    return getAgentWallet(agentId)?.walletAddress;
}

export function creditAgent(agentId: string, amount: number): void {
    const wallet = getAgentWallet(agentId);
    if (wallet) {
        wallet.totalEarnings += amount;
        wallet.pendingBalance += amount;
        logger.info('WalletRegistry', `💵 Credited ${agentId}: +$${amount.toFixed(4)} (Total: $${wallet.totalEarnings.toFixed(4)})`);
    }
}

export function getAllWallets(): AgentWallet[] {
    return Array.from(walletRegistry.values());
}

export function getWalletStats(): { totalEarnings: number; agentCount: number } {
    const wallets = getAllWallets();
    return {
        totalEarnings: wallets.reduce((sum, w) => sum + w.totalEarnings, 0),
        agentCount: wallets.length,
    };
}
