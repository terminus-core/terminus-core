// =============================================================================
// TERMINUS CONTROL PLANE - x402 Payment Configuration
// =============================================================================

export interface PaymentConfig {
    enabled: boolean;
    network: 'base-mainnet' | 'base-sepolia';
    chainId: number;
    facilitatorUrl: string;
    usdcAddress: string;
    orchestratorWallet: string;
    queryPriceUSDC: number;
    orchestratorShare: number;  // 0.5 = 50%
    agentShare: number;         // 0.5 = 50% (split among agents)
}

// Base network addresses
const USDC_ADDRESSES = {
    'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

const CHAIN_IDS = {
    'base-mainnet': 8453,
    'base-sepolia': 84532,
};

export function getPaymentConfig(): PaymentConfig {
    const network = (process.env.X402_NETWORK || 'base-sepolia') as 'base-mainnet' | 'base-sepolia';

    return {
        enabled: process.env.X402_ENABLED === 'true',
        network,
        chainId: CHAIN_IDS[network],
        facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
        usdcAddress: USDC_ADDRESSES[network],
        orchestratorWallet: process.env.ORCHESTRATOR_WALLET || '',
        queryPriceUSDC: parseFloat(process.env.QUERY_PRICE_USDC || '0.10'),
        orchestratorShare: 0.50,
        agentShare: 0.50,
    };
}

// USDC has 6 decimals
export function usdToMicroUsdc(usd: number): bigint {
    return BigInt(Math.round(usd * 1_000_000));
}

export function microUsdcToUsd(microUsdc: bigint): number {
    return Number(microUsdc) / 1_000_000;
}
