// =============================================================================
// TERMINUS CONTROL PLANE - Payment Distributor
// =============================================================================
// Distributes payments from orchestrator to participating agents.
// =============================================================================

import { logger } from '../logger.js';
import { getPaymentConfig } from './config.js';
import { creditAgent, getAgentAddress } from './wallet-generator.js';

export interface PaymentDistribution {
    totalAmount: number;
    orchestratorAmount: number;
    agentPayments: { agentId: string; amount: number; wallet: string }[];
    timestamp: Date;
}

// In-memory ledger for tracking (production: use database + on-chain settlement)
const paymentLedger: PaymentDistribution[] = [];
let orchestratorEarnings = 0;

// =============================================================================
// Distribution Logic
// =============================================================================

export function distributePayment(
    totalAmountUSDC: number,
    agentIds: string[]
): PaymentDistribution {
    const config = getPaymentConfig();

    // Calculate shares
    const orchestratorAmount = totalAmountUSDC * config.orchestratorShare;
    const totalAgentAmount = totalAmountUSDC * config.agentShare;
    const perAgentAmount = agentIds.length > 0 ? totalAgentAmount / agentIds.length : 0;

    // Credit orchestrator
    orchestratorEarnings += orchestratorAmount;
    logger.info('PaymentDistributor', `🏦 Orchestrator: +$${orchestratorAmount.toFixed(4)} (Total: $${orchestratorEarnings.toFixed(4)})`);

    // Credit each agent
    const agentPayments = agentIds.map(agentId => {
        const wallet = getAgentAddress(agentId);
        creditAgent(agentId, perAgentAmount);
        return { agentId, amount: perAgentAmount, wallet };
    });

    // Log distribution
    const distribution: PaymentDistribution = {
        totalAmount: totalAmountUSDC,
        orchestratorAmount,
        agentPayments,
        timestamp: new Date(),
    };

    paymentLedger.push(distribution);

    logger.info('PaymentDistributor', `💰 Distributed $${totalAmountUSDC.toFixed(4)}: Orchestrator $${orchestratorAmount.toFixed(4)}, Agents (${agentIds.length}): $${perAgentAmount.toFixed(4)} each`);

    return distribution;
}

// =============================================================================
// Ledger Access
// =============================================================================

export function getPaymentLedger(): PaymentDistribution[] {
    return [...paymentLedger];
}

export function getOrchestratorEarnings(): number {
    return orchestratorEarnings;
}

export function getPaymentStats(): {
    totalProcessed: number;
    orchestratorEarnings: number;
    transactionCount: number;
} {
    const totalProcessed = paymentLedger.reduce((sum, p) => sum + p.totalAmount, 0);
    return {
        totalProcessed,
        orchestratorEarnings,
        transactionCount: paymentLedger.length,
    };
}
