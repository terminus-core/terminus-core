// =============================================================================
// TERMINUS CONTROL PLANE - User Balance Ledger
// =============================================================================
// Tracks user deposits and balances for pre-paid query system.
// Users deposit USDC once, balance is deducted per successful query.
// Balances are persisted to JSON file for durability.
// =============================================================================

import { logger } from '../logger.js';
import { ethers } from 'ethers';
import { getPaymentConfig } from './config.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// =============================================================================
// Types
// =============================================================================

export interface UserBalance {
    wallet: string;
    balance: number;           // Current USDC balance
    totalDeposited: number;    // Lifetime deposits
    totalSpent: number;        // Lifetime spending
    depositHistory: DepositRecord[];
    lastActivity: number;
}

export interface DepositRecord {
    txHash: string;
    amount: number;
    timestamp: number;
    confirmed: boolean;
}

// =============================================================================
// File Persistence
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');
const BALANCES_FILE = join(DATA_DIR, 'user-balances.json');
const DEPOSITS_FILE = join(DATA_DIR, 'processed-deposits.json');

// Ensure data directory exists
function ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
        logger.info('Persistence', `📁 Created data directory: ${DATA_DIR}`);
    }
}

// Atomic write with temp file
function atomicWriteJson(filePath: string, data: unknown): void {
    const tempPath = filePath + '.tmp';
    writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug('Persistence', `💾 Saved ${filePath}`);
}

// =============================================================================
// In-Memory Ledger (with persistence)
// =============================================================================

const userBalances = new Map<string, UserBalance>();
const processedDeposits = new Set<string>(); // Prevent double-processing

// Load data from disk on startup
function loadData(): void {
    ensureDataDir();

    // Load user balances
    if (existsSync(BALANCES_FILE)) {
        try {
            const data = JSON.parse(readFileSync(BALANCES_FILE, 'utf-8')) as UserBalance[];
            for (const user of data) {
                userBalances.set(user.wallet.toLowerCase(), user);
            }
            logger.info('Persistence', `📂 Loaded ${data.length} user balances from disk`);
        } catch (error) {
            logger.error('Persistence', `❌ Failed to load balances: ${(error as Error).message}`);
        }
    }

    // Load processed deposits
    if (existsSync(DEPOSITS_FILE)) {
        try {
            const data = JSON.parse(readFileSync(DEPOSITS_FILE, 'utf-8')) as string[];
            for (const txHash of data) {
                processedDeposits.add(txHash);
            }
            logger.info('Persistence', `📂 Loaded ${data.length} processed deposits from disk`);
        } catch (error) {
            logger.error('Persistence', `❌ Failed to load deposits: ${(error as Error).message}`);
        }
    }
}

// Save data to disk
function saveData(): void {
    ensureDataDir();

    try {
        atomicWriteJson(BALANCES_FILE, Array.from(userBalances.values()));
        atomicWriteJson(DEPOSITS_FILE, Array.from(processedDeposits));
    } catch (error) {
        logger.error('Persistence', `❌ Failed to save data: ${(error as Error).message}`);
    }
}

// Load on module init
loadData();

// USDC ABI for reading transfer events
const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const RPC_URL = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// =============================================================================
// Balance Management
// =============================================================================

export function getUserBalance(wallet: string): UserBalance | null {
    const normalized = wallet.toLowerCase();
    return userBalances.get(normalized) || null;
}

export function getOrCreateUserBalance(wallet: string): UserBalance {
    const normalized = wallet.toLowerCase();
    let user = userBalances.get(normalized);

    if (!user) {
        user = {
            wallet: normalized,
            balance: 0,
            totalDeposited: 0,
            totalSpent: 0,
            depositHistory: [],
            lastActivity: Date.now(),
        };
        userBalances.set(normalized, user);
    }

    return user;
}

export function hasEnoughBalance(wallet: string, amount: number): boolean {
    const user = getUserBalance(wallet);
    return user !== null && user.balance >= amount;
}

export function deductBalance(wallet: string, amount: number): boolean {
    const user = getUserBalance(wallet);
    if (!user || user.balance < amount) {
        return false;
    }

    user.balance -= amount;
    user.totalSpent += amount;
    user.lastActivity = Date.now();

    saveData(); // Persist to disk
    logger.info('UserBalance', `💸 Deducted $${amount.toFixed(4)} from ${wallet.slice(0, 10)}... (Remaining: $${user.balance.toFixed(4)})`);
    return true;
}

export function creditBalance(wallet: string, amount: number, txHash?: string): void {
    const user = getOrCreateUserBalance(wallet);

    user.balance += amount;
    user.totalDeposited += amount;
    user.lastActivity = Date.now();

    if (txHash) {
        user.depositHistory.push({
            txHash,
            amount,
            timestamp: Date.now(),
            confirmed: true,
        });
    }

    saveData(); // Persist to disk
    logger.info('UserBalance', `💰 Credited $${amount.toFixed(4)} to ${wallet.slice(0, 10)}... (New Balance: $${user.balance.toFixed(4)})`);
}

// =============================================================================
// Deposit Verification
// =============================================================================

export async function verifyAndCreditDeposit(
    txHash: string,
    expectedFromWallet: string
): Promise<{ success: boolean; amount?: number; error?: string }> {
    // Prevent double-processing
    if (processedDeposits.has(txHash)) {
        return { success: false, error: 'Deposit already processed' };
    }

    const config = getPaymentConfig();

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!receipt) {
            return { success: false, error: 'Transaction not found' };
        }

        if (receipt.status !== 1) {
            return { success: false, error: 'Transaction failed' };
        }

        // Parse USDC transfer logs
        const usdc = new ethers.Contract(config.usdcAddress, USDC_ABI, provider);
        const transferLogs = receipt.logs.filter(
            log => log.address.toLowerCase() === config.usdcAddress.toLowerCase()
        );

        for (const log of transferLogs) {
            try {
                const parsed = usdc.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });

                if (parsed?.name === 'Transfer') {
                    const from = parsed.args[0].toLowerCase();
                    const to = parsed.args[1].toLowerCase();
                    const value = parsed.args[2];

                    // Check if transfer is to orchestrator wallet
                    if (to === config.orchestratorWallet?.toLowerCase()) {
                        // Verify sender matches expected wallet
                        if (from !== expectedFromWallet.toLowerCase()) {
                            return { success: false, error: 'Sender wallet mismatch' };
                        }

                        const amountUSDC = Number(value) / 1_000_000;

                        // Mark as processed and credit
                        processedDeposits.add(txHash);
                        creditBalance(expectedFromWallet, amountUSDC, txHash);

                        logger.info('Deposit', `✅ Verified deposit: $${amountUSDC.toFixed(2)} USDC from ${from.slice(0, 10)}...`);

                        return { success: true, amount: amountUSDC };
                    }
                }
            } catch {
                // Skip unparseable logs
            }
        }

        return { success: false, error: 'No valid USDC transfer to orchestrator found' };
    } catch (error) {
        logger.error('Deposit', `❌ Verification failed: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}

// =============================================================================
// Stats
// =============================================================================

export function getAllUserBalances(): UserBalance[] {
    return Array.from(userBalances.values());
}

export function getBalanceStats(): {
    totalUsers: number;
    totalDeposited: number;
    totalSpent: number;
    activeBalance: number;
} {
    const users = getAllUserBalances();
    return {
        totalUsers: users.length,
        totalDeposited: users.reduce((sum, u) => sum + u.totalDeposited, 0),
        totalSpent: users.reduce((sum, u) => sum + u.totalSpent, 0),
        activeBalance: users.reduce((sum, u) => sum + u.balance, 0),
    };
}
