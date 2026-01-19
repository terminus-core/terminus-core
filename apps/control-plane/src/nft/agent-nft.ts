// =============================================================================
// TERMINUS CONTROL PLANE - ERC-8004 Agent NFT Verification
// =============================================================================
// Verifies that a wallet owns a specific agent NFT before allowing node access.
// =============================================================================

import { ethers } from 'ethers';
import { logger } from '../logger.js';

// =============================================================================
// Configuration
// =============================================================================

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// TerminusAgents contract (our custom ERC-721)
const TERMINUS_AGENTS_CONTRACT = process.env.TERMINUS_AGENTS_CONTRACT || '0x170b4196e6228d3abd2d497bacade8f6fc1a9f53';

// Agent ID to Agent Type mapping (on-chain minted NFTs)
const AGENT_NFT_IDS: Record<string, number> = {
    'travel-planner': 0,
    'health-advisor': 1,
};

// ERC-721 minimal ABI for TerminusAgents
const TERMINUS_AGENTS_ABI = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function getAgentType(uint256 agentId) view returns (string)',
    'function balanceOf(address owner) view returns (uint256)',
    'function totalAgents() view returns (uint256)',
];

// =============================================================================
// Provider
// =============================================================================

let provider: ethers.JsonRpcProvider | null = null;
let terminusAgents: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    }
    return provider;
}

function getTerminusAgents(): ethers.Contract {
    if (!terminusAgents) {
        terminusAgents = new ethers.Contract(
            TERMINUS_AGENTS_CONTRACT,
            TERMINUS_AGENTS_ABI,
            getProvider()
        );
    }
    return terminusAgents;
}

// =============================================================================
// Verification Functions
// =============================================================================

/**
 * Check if a wallet owns a specific agent NFT
 */
export async function verifyAgentOwnership(
    wallet: string,
    agentType: string
): Promise<{ valid: boolean; agentId?: number; error?: string }> {
    const agentId = AGENT_NFT_IDS[agentType];

    if (agentId === undefined) {
        return { valid: false, error: `Unknown agent type: ${agentType}` };
    }

    try {
        const registry = getTerminusAgents();
        const owner = await registry.ownerOf(agentId);

        if (owner.toLowerCase() === wallet.toLowerCase()) {
            logger.info('NFTVerify', `✅ Wallet ${wallet.slice(0, 10)}... owns ${agentType} (ID: ${agentId})`);
            return { valid: true, agentId };
        } else {
            logger.warn('NFTVerify', `❌ Wallet ${wallet.slice(0, 10)}... does NOT own ${agentType}`);
            return { valid: false, agentId, error: `Wallet does not own ${agentType} NFT` };
        }
    } catch (error) {
        logger.error('NFTVerify', `Error verifying ownership: ${(error as Error).message}`);
        return { valid: false, error: (error as Error).message };
    }
}

/**
 * Verify that a signature was created by the claimed wallet address.
 * Message format: "terminus-auth:{nodeId}"
 */
export function verifyWalletSignature(
    nodeId: string,
    claimedWallet: string,
    signature: string
): { valid: boolean; recoveredAddress?: string; error?: string } {
    const message = `terminus-auth:${nodeId}`;

    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() === claimedWallet.toLowerCase()) {
            logger.info('SigVerify', `✅ Signature valid for ${claimedWallet.slice(0, 10)}...`);
            return { valid: true, recoveredAddress };
        } else {
            logger.warn('SigVerify', `❌ Signature mismatch: claimed ${claimedWallet.slice(0, 10)}... recovered ${recoveredAddress.slice(0, 10)}...`);
            return {
                valid: false,
                recoveredAddress,
                error: `Signature does not match claimed wallet`
            };
        }
    } catch (error) {
        logger.error('SigVerify', `Invalid signature: ${(error as Error).message}`);
        return { valid: false, error: 'Invalid signature format' };
    }
}

/**
 * Generate the message that should be signed by the wallet
 */
export function getAuthMessage(nodeId: string): string {
    return `terminus-auth:${nodeId}`;
}

/**
 * Check if a wallet owns ANY agent NFT
 */
export async function walletOwnsAnyAgent(wallet: string): Promise<{ valid: boolean; count: number }> {
    try {
        const registry = getTerminusAgents();
        const balance = await registry.balanceOf(wallet);
        const count = Number(balance);

        logger.info('NFTVerify', `Wallet ${wallet.slice(0, 10)}... owns ${count} agent NFT(s)`);
        return { valid: count > 0, count };
    } catch (error) {
        logger.error('NFTVerify', `Error checking balance: ${(error as Error).message}`);
        return { valid: false, count: 0 };
    }
}

/**
 * Get all agent IDs owned by a wallet (limited check)
 */
export async function getOwnedAgentIds(wallet: string): Promise<number[]> {
    const ownedIds: number[] = [];

    for (const [agentType, agentId] of Object.entries(AGENT_NFT_IDS)) {
        try {
            const registry = getTerminusAgents();
            const owner = await registry.ownerOf(agentId);

            if (owner.toLowerCase() === wallet.toLowerCase()) {
                ownedIds.push(agentId);
            }
        } catch {
            // Token doesn't exist or other error
        }
    }

    return ownedIds;
}

/**
 * Get agent type from NFT ID
 */
export function getAgentTypeFromId(agentId: number): string | null {
    for (const [agentType, id] of Object.entries(AGENT_NFT_IDS)) {
        if (id === agentId) return agentType;
    }
    return null;
}

/**
 * Get agent NFT ID from type
 */
export function getAgentIdFromType(agentType: string): number | null {
    return AGENT_NFT_IDS[agentType] ?? null;
}

// =============================================================================
// Configuration Exports
// =============================================================================

export const NFT_CONFIG = {
    terminusAgentsContract: TERMINUS_AGENTS_CONTRACT,
    rpcUrl: BASE_SEPOLIA_RPC,
    agentNftIds: AGENT_NFT_IDS,
};
