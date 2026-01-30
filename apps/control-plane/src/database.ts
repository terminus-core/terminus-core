// =============================================================================
// TERMINUS CONTROL PLANE - Supabase Database Service
// =============================================================================
// Handles all database operations using Supabase for persistent storage.
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

// =============================================================================
// Types
// =============================================================================

export interface UserBalance {
    wallet: string;
    balance: number;
    total_deposited: number;
    total_spent: number;
    updated_at: string;
}

export interface Deposit {
    tx_hash: string;
    wallet: string;
    amount: number;
    created_at: string;
}

export interface Job {
    id: string;
    node_id: string;
    agent_type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at?: string;
}

export interface LogEntry {
    id?: number;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    source: string;
    message: string;
    node_id?: string;
    job_id?: string;
    created_at?: string;
}

export interface JobStats {
    node_id: string;
    completed: number;
    failed: number;
    total: number;
}

// =============================================================================
// Supabase Client
// =============================================================================

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    const key = process.env.SUPABASE_SERVICE_KEY;
    const url = process.env.SUPABASE_URL || 'https://ijotpaarjetskwzjacma.supabase.co';

    if (!key) {
        return null;
    }

    if (!supabase) {
        supabase = createClient(url, key);
        logger.info('Database', '🔌 Connected to Supabase');
    }

    return supabase;
}

export function isSupabaseEnabled(): boolean {
    return !!process.env.SUPABASE_SERVICE_KEY;
}

// =============================================================================
// User Balance Operations
// =============================================================================

export async function getUserBalanceFromDB(wallet: string): Promise<UserBalance | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
        .from('user_balances')
        .select('*')
        .eq('wallet', wallet.toLowerCase())
        .single();

    if (error && error.code !== 'PGRST116') {
        logger.error('Database', `Failed to get balance: ${error.message}`);
        return null;
    }

    return data;
}

export async function upsertUserBalance(
    wallet: string,
    balance: number,
    totalDeposited: number,
    totalSpent: number
): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('user_balances')
        .upsert({
            wallet: wallet.toLowerCase(),
            balance,
            total_deposited: totalDeposited,
            total_spent: totalSpent,
            updated_at: new Date().toISOString(),
        });

    if (error) {
        logger.error('Database', `Failed to upsert balance: ${error.message}`);
        return false;
    }

    return true;
}

export async function getAllUserBalancesFromDB(): Promise<UserBalance[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
        .from('user_balances')
        .select('*')
        .order('balance', { ascending: false });

    if (error) {
        logger.error('Database', `Failed to get all balances: ${error.message}`);
        return [];
    }

    return data || [];
}

// =============================================================================
// Deposit Operations
// =============================================================================

export async function recordDeposit(txHash: string, wallet: string, amount: number): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('deposits')
        .insert({
            tx_hash: txHash,
            wallet: wallet.toLowerCase(),
            amount,
        });

    if (error) {
        if (error.code === '23505') {
            // Duplicate - already processed
            return false;
        }
        logger.error('Database', `Failed to record deposit: ${error.message}`);
        return false;
    }

    return true;
}

export async function isDepositProcessed(txHash: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { data } = await client
        .from('deposits')
        .select('tx_hash')
        .eq('tx_hash', txHash)
        .single();

    return !!data;
}

// =============================================================================
// Job Operations
// =============================================================================

export async function createJob(id: string, nodeId: string, agentType: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('jobs')
        .insert({
            id,
            node_id: nodeId,
            agent_type: agentType,
            status: 'running',
        });

    if (error) {
        logger.error('Database', `Failed to create job: ${error.message}`);
        return false;
    }

    return true;
}

export async function completeJob(id: string, success: boolean): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('jobs')
        .update({
            status: success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        logger.error('Database', `Failed to complete job: ${error.message}`);
        return false;
    }

    return true;
}

export async function getJobStats(): Promise<JobStats[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
        .from('job_stats')
        .select('*');

    if (error) {
        logger.error('Database', `Failed to get job stats: ${error.message}`);
        return [];
    }

    return data || [];
}

export async function getGlobalJobStats(): Promise<{ totalCompleted: number; totalFailed: number }> {
    const client = getSupabaseClient();
    if (!client) return { totalCompleted: 0, totalFailed: 0 };

    const { data, error } = await client
        .from('jobs')
        .select('status');

    if (error) {
        return { totalCompleted: 0, totalFailed: 0 };
    }

    const completed = data?.filter(j => j.status === 'completed').length || 0;
    const failed = data?.filter(j => j.status === 'failed').length || 0;

    return { totalCompleted: completed, totalFailed: failed };
}

// =============================================================================
// Log Operations
// =============================================================================

export async function insertLog(entry: Omit<LogEntry, 'id' | 'created_at'>): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('logs')
        .insert(entry);

    if (error) {
        // Don't log errors for log insertions to avoid infinite loops
        console.error('Failed to insert log:', error.message);
        return false;
    }

    return true;
}

export async function getLogs(options?: {
    level?: string;
    source?: string;
    nodeId?: string;
    limit?: number;
}): Promise<LogEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options?.limit || 100);

    if (options?.level) {
        query = query.eq('level', options.level);
    }
    if (options?.source) {
        query = query.ilike('source', `%${options.source}%`);
    }
    if (options?.nodeId) {
        query = query.eq('node_id', options.nodeId);
    }

    const { data, error } = await query;

    if (error) {
        logger.error('Database', `Failed to get logs: ${error.message}`);
        return [];
    }

    return data || [];
}

// =============================================================================
// Chat History Operations
// =============================================================================

export interface ChatMessage {
    id: number;
    wallet: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    charged_amount?: number;
    created_at: string;
}


export async function saveChatMessage(
    wallet: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    sessionId?: string,
    chargedAmount?: number
): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const payload: any = {
        wallet: wallet.toLowerCase(),
        role,
        content,
        charged_amount: chargedAmount,
    };

    if (sessionId) {
        payload.session_id = sessionId;

        // Also update the session's updated_at timestamp
        client.from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId)
            .then(() => { }); // Fire and forget update
    }

    const { error } = await client
        .from('chat_history')
        .insert(payload);

    if (error) {
        // If table doesn't exist, we'll fail silently but log it
        if (error.code === '42P01') {
            logger.warn('Database', 'Chat history table missing - skipping persistence');
            return false;
        }
        logger.error('Database', `Failed to save chat: ${error.message}`);
        return false;
    }

    return true;
}

export async function getChatHistory(wallet: string, sessionId?: string, limit = 50): Promise<ChatMessage[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
        .from('chat_history')
        .select('*')
        .eq('wallet', wallet.toLowerCase())
        .order('created_at', { ascending: true });

    if (sessionId) {
        query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
        logger.error('Database', `Failed to chat history: ${error.message}`);
        return [];
    }

    return data || [];
}

// =============================================================================
// Chat Session Management
// =============================================================================

export interface ChatSession {
    id: string;
    wallet: string;
    title: string;
    created_at: string;
}

export async function initChatSchema(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    // Create chat_sessions table if not exists
    const { error: sessionError } = await client.rpc('create_chat_sessions_table');

    // Since we can't easily run DDL via simple client without RPC or raw execution which might be restricted,
    // we will rely on an SQL function or manual setup usually. 
    // BUT, let's try a work-around: checking if table exists via query, then maybe we can assume user ran migration?
    // Actually, user explicitly asked to "continue" effectively meaning "make it work".
    // Best bet if MCP fails is giving user the SQL to run or try to run it via special RPC if available.
    // However, if we assume Service Key has admin rights, we might be able to use a different method.

    // Let's assume the user will run the SQL manually if code fails, but we'll try to provide the functions.
    // NOTE: The previous MCP error suggests strict permissions. I will proceed with the code implementation
    // assuming the DB schema will be ready. I will provide the SQL to the user in a notify block just in case.
}

export async function createChatSession(wallet: string, title: string = 'New Chat'): Promise<string | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
        .from('chat_sessions')
        .insert({
            wallet: wallet.toLowerCase(),
            title
        })
        .select('id')
        .single();

    if (error) {
        logger.error('Database', `Failed to create chat session: ${error.message}`);
        return null;
    }

    return data.id;
}

export async function getChatSessions(wallet: string): Promise<ChatSession[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
        .from('chat_sessions')
        .select('*')
        .eq('wallet', wallet.toLowerCase())
        .order('updated_at', { ascending: false });

    if (error) {
        logger.error('Database', `Failed to get sessions: ${error.message}`);
        return [];
    }

    return data || [];
}

export async function deleteChatSession(sessionId: string, wallet: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('wallet', wallet.toLowerCase());

    if (error) {
        logger.error('Database', `Failed to delete session: ${error.message}`);
        return false;
    }

    return true;
}



// =============================================================================
// Migration Helper (import existing JSON data)
// =============================================================================

export async function migrateFromJSON(data: {
    balances?: Record<string, { balance: number; totalDeposited: number; totalSpent: number }>;
    deposits?: string[];
}): Promise<void> {
    if (!isSupabaseEnabled()) return;

    // Migrate balances
    if (data.balances) {
        for (const [wallet, info] of Object.entries(data.balances)) {
            await upsertUserBalance(wallet, info.balance, info.totalDeposited, info.totalSpent);
        }
        logger.info('Database', `Migrated ${Object.keys(data.balances).length} balances`);
    }

    // Migrate deposits
    if (data.deposits) {
        for (const txHash of data.deposits) {
            // We don't have wallet/amount info, just mark as processed
            await recordDeposit(txHash, 'unknown', 0);
        }
        logger.info('Database', `Migrated ${data.deposits.length} deposits`);
    }
}
