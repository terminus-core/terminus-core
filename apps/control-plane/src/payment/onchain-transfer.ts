// =============================================================================
// TERMINUS CONTROL PLANE - On-Chain USDC Distributor
// =============================================================================
// Uses ethers.js to distribute USDC to agent wallets on-chain.
// For gasless transfers, we use x402 facilitator or Coinbase Paymaster.
// =============================================================================

import { ethers } from 'ethers';
import { logger } from '../logger.js';
import { getPaymentConfig } from './config.js';
import { getAgentAddress } from './wallet-generator.js';

// USDC ERC20 ABI (minimal)
const USDC_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

// Base Sepolia RPC
const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// =============================================================================
// On-Chain Transfer
// =============================================================================

interface TransferResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export async function transferUSDC(
    toAddress: string,
    amountUSDC: number
): Promise<TransferResult> {
    const config = getPaymentConfig();
    const privateKey = process.env.ORCHESTRATOR_PRIVATE_KEY;

    if (!privateKey) {
        logger.warn('OnChainTransfer', '⚠️ No ORCHESTRATOR_PRIVATE_KEY - skipping on-chain transfer');
        return { success: false, error: 'No private key configured' };
    }

    try {
        // Connect to Base Sepolia
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        // USDC contract
        const usdc = new ethers.Contract(config.usdcAddress, USDC_ABI, wallet);

        // Convert to 6 decimals
        const amount = BigInt(Math.round(amountUSDC * 1_000_000));

        logger.info('OnChainTransfer', `📤 Sending ${amountUSDC} USDC to ${toAddress.slice(0, 10)}...`);

        // Send transfer
        const tx = await usdc.transfer(toAddress, amount);
        logger.info('OnChainTransfer', `⏳ Tx sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        logger.info('OnChainTransfer', `✅ Confirmed in block ${receipt.blockNumber}`);

        return { success: true, txHash: tx.hash };
    } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error('OnChainTransfer', `❌ Transfer failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}

// =============================================================================
// Batch Distribution to Agents
// =============================================================================

interface DistributionResult {
    agentId: string;
    address: string;
    amount: number;
    txHash?: string;
    success: boolean;
    error?: string;
}

export async function distributeToAgentsOnChain(
    agentIds: string[],
    totalAgentAmount: number
): Promise<DistributionResult[]> {
    if (agentIds.length === 0) return [];

    const perAgentAmount = totalAgentAmount / agentIds.length;
    const results: DistributionResult[] = [];

    for (const agentId of agentIds) {
        const address = getAgentAddress(agentId);
        const result = await transferUSDC(address, perAgentAmount);

        results.push({
            agentId,
            address,
            amount: perAgentAmount,
            txHash: result.txHash,
            success: result.success,
            error: result.error,
        });

        // Small delay between transfers to avoid nonce issues
        await new Promise(r => setTimeout(r, 500));
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('OnChainTransfer', `📊 Distribution complete: ${successCount}/${agentIds.length} successful`);

    return results;
}

// =============================================================================
// Check Orchestrator Balance
// =============================================================================

export async function getOrchestratorBalance(): Promise<{ usdc: number; eth: number } | null> {
    const privateKey = process.env.ORCHESTRATOR_PRIVATE_KEY;
    if (!privateKey) return null;

    try {
        const config = getPaymentConfig();
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        // ETH balance
        const ethBalance = await provider.getBalance(wallet.address);

        // USDC balance
        const usdc = new ethers.Contract(config.usdcAddress, USDC_ABI, provider);
        const usdcBalance = await usdc.balanceOf(wallet.address);

        return {
            usdc: Number(usdcBalance) / 1_000_000,
            eth: Number(ethBalance) / 1e18,
        };
    } catch (error) {
        logger.error('OnChainTransfer', `Balance check failed: ${(error as Error).message}`);
        return null;
    }
}
