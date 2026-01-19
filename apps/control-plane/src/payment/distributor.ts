// =============================================================================
// TERMINUS CONTROL PLANE - Payment Distributor
// =============================================================================
// Distributes payments from orchestrator to participating agents.
// Supports both internal ledger and on-chain USDC transfers.
// =============================================================================

import { logger } from '../logger.js';
import { getPaymentConfig } from './config.js';
import { creditAgent, getAgentAddress } from './wallet-generator.js';
import { distributeToAgentsOnChain } from './onchain-transfer.js';

// =============================================================================
// Types
// =============================================================================

export interface PaymentTransaction {
    id: string;
    type: 'user_payment' | 'orchestrator_share' | 'agent_payment';
    from: string;
    to: string;
    amount: number;
    timestamp: Date;
    status: 'pending' | 'completed' | 'failed';
    txHash?: string;
    note?: string;
}

export interface PaymentDistribution {
    id: string;
    totalAmount: number;
    orchestratorAmount: number;
    agentPayments: { agentId: string; amount: number; wallet: string; txHash?: string }[];
    transactions: PaymentTransaction[];
    timestamp: Date;
    onChain: boolean;
}

// In-memory ledger
const paymentLedger: PaymentDistribution[] = [];
const allTransactions: PaymentTransaction[] = [];
let orchestratorEarnings = 0;
let transactionCounter = 0;

function generateTxId(): string {
    transactionCounter++;
    return `tx_${Date.now()}_${transactionCounter.toString().padStart(4, '0')}`;
}

// =============================================================================
// Distribution Logic
// =============================================================================

export async function distributePayment(
    totalAmountUSDC: number,
    agentIds: string[],
    userWallet?: string,
    userTxHash?: string
): Promise<PaymentDistribution> {
    const config = getPaymentConfig();
    const onChainEnabled = process.env.ONCHAIN_DISTRIBUTION === 'true';
    const distributionId = `dist_${Date.now()}`;
    const transactions: PaymentTransaction[] = [];

    // 1. User payment to orchestrator
    const userPaymentTx: PaymentTransaction = {
        id: userTxHash || generateTxId(),
        type: 'user_payment',
        from: userWallet || 'user',
        to: config.orchestratorWallet || 'orchestrator',
        amount: totalAmountUSDC,
        timestamp: new Date(),
        status: 'completed',
        txHash: userTxHash,
        note: `User query payment`,
    };
    transactions.push(userPaymentTx);
    allTransactions.push(userPaymentTx);
    logger.info('PaymentTx', `📥 ${userPaymentTx.from.slice(0, 8)}... → Orchestrator: $${totalAmountUSDC.toFixed(4)} USDC`);

    // Calculate shares
    const orchestratorAmount = totalAmountUSDC * config.orchestratorShare;
    const totalAgentAmount = totalAmountUSDC * config.agentShare;
    const perAgentAmount = agentIds.length > 0 ? totalAgentAmount / agentIds.length : 0;

    // 2. Orchestrator keeps share
    const orchestratorTx: PaymentTransaction = {
        id: generateTxId(),
        type: 'orchestrator_share',
        from: 'payment_pool',
        to: config.orchestratorWallet || 'orchestrator',
        amount: orchestratorAmount,
        timestamp: new Date(),
        status: 'completed',
        note: `Orchestrator fee (${config.orchestratorShare * 100}%)`,
    };
    transactions.push(orchestratorTx);
    allTransactions.push(orchestratorTx);
    orchestratorEarnings += orchestratorAmount;
    logger.info('PaymentTx', `🏦 Orchestrator share: $${orchestratorAmount.toFixed(4)} USDC (${config.orchestratorShare * 100}%)`);

    // 3. Distribute to agents
    let agentPayments: { agentId: string; amount: number; wallet: string; txHash?: string }[] = [];

    if (onChainEnabled && agentIds.length > 0) {
        // On-chain distribution
        logger.info('PaymentTx', `⛓️ On-chain distribution to ${agentIds.length} agents...`);
        const onChainResults = await distributeToAgentsOnChain(agentIds, totalAgentAmount);

        agentPayments = onChainResults.map(result => {
            const agentTx: PaymentTransaction = {
                id: result.txHash || generateTxId(),
                type: 'agent_payment',
                from: config.orchestratorWallet || 'orchestrator',
                to: result.address,
                amount: result.amount,
                timestamp: new Date(),
                status: result.success ? 'completed' : 'failed',
                txHash: result.txHash,
                note: `Payment to ${result.agentId}${result.error ? ` (${result.error})` : ''}`,
            };
            transactions.push(agentTx);
            allTransactions.push(agentTx);

            // Credit agent in internal ledger too
            creditAgent(result.agentId, result.amount);

            return {
                agentId: result.agentId,
                amount: result.amount,
                wallet: result.address,
                txHash: result.txHash,
            };
        });
    } else {
        // Internal ledger only
        agentPayments = agentIds.map(agentId => {
            const wallet = getAgentAddress(agentId);
            creditAgent(agentId, perAgentAmount);

            const agentTx: PaymentTransaction = {
                id: generateTxId(),
                type: 'agent_payment',
                from: 'payment_pool',
                to: wallet,
                amount: perAgentAmount,
                timestamp: new Date(),
                status: 'completed',
                note: `Payment to ${agentId} (ledger)`,
            };
            transactions.push(agentTx);
            allTransactions.push(agentTx);
            logger.info('PaymentTx', `💸 → ${agentId}: $${perAgentAmount.toFixed(4)} USDC (ledger)`);

            return { agentId, amount: perAgentAmount, wallet };
        });
    }

    // Log distribution summary
    const distribution: PaymentDistribution = {
        id: distributionId,
        totalAmount: totalAmountUSDC,
        orchestratorAmount,
        agentPayments,
        transactions,
        timestamp: new Date(),
        onChain: onChainEnabled,
    };

    paymentLedger.push(distribution);

    logger.info('PaymentDistributor', `✅ Distribution complete: $${totalAmountUSDC.toFixed(4)} → Orchestrator $${orchestratorAmount.toFixed(4)} + ${agentIds.length} agents ${onChainEnabled ? '(on-chain)' : '(ledger)'}`);

    return distribution;
}

// =============================================================================
// Ledger Access
// =============================================================================

export function getPaymentLedger(): PaymentDistribution[] {
    return [...paymentLedger];
}

export function getAllTransactions(limit = 50): PaymentTransaction[] {
    return allTransactions.slice(-limit).reverse();
}

export function getOrchestratorEarnings(): number {
    return orchestratorEarnings;
}

export function getPaymentStats(): {
    totalProcessed: number;
    orchestratorEarnings: number;
    transactionCount: number;
    distributions: number;
    onChainEnabled: boolean;
} {
    const totalProcessed = paymentLedger.reduce((sum, p) => sum + p.totalAmount, 0);
    return {
        totalProcessed,
        orchestratorEarnings,
        transactionCount: allTransactions.length,
        distributions: paymentLedger.length,
        onChainEnabled: process.env.ONCHAIN_DISTRIBUTION === 'true',
    };
}
