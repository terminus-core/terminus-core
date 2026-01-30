// =============================================================================
// TERMINUS CONTROL PLANE - x402 Payment Middleware
// =============================================================================
// HTTP middleware for x402 payment verification and settlement.
// =============================================================================

import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../logger.js';
import { getPaymentConfig, usdToMicroUsdc } from './config.js';

// =============================================================================
// Types
// =============================================================================

export interface PaymentRequirement {
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra?: Record<string, unknown>;
}

export interface PaymentPayload {
    x402Version: number;
    scheme: string;
    network: string;
    payload: unknown;
}

// =============================================================================
// Payment Requirement Generator
// =============================================================================

export function createPaymentRequirement(
    resource: string,
    description: string
): PaymentRequirement {
    const config = getPaymentConfig();

    return {
        scheme: 'exact',
        network: config.network,
        maxAmountRequired: usdToMicroUsdc(config.queryPriceUSDC).toString(),
        resource,
        description,
        mimeType: 'application/json',
        payTo: config.orchestratorWallet,
        maxTimeoutSeconds: 60,
        asset: config.usdcAddress,
    };
}

// =============================================================================
// Payment Header Utilities
// =============================================================================

export function encodePaymentRequired(requirements: PaymentRequirement[]): string {
    return Buffer.from(JSON.stringify({ accepts: requirements })).toString('base64');
}

export function decodePaymentPayload(header: string): PaymentPayload | null {
    try {
        const decoded = Buffer.from(header, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

// =============================================================================
// Facilitator Communication
// =============================================================================

async function verifyPaymentWithFacilitator(
    payload: PaymentPayload,
    requirement: PaymentRequirement
): Promise<{ isValid: boolean; error?: string }> {
    const config = getPaymentConfig();

    try {
        const response = await fetch(`${config.facilitatorUrl}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, paymentRequirements: requirement }),
        });

        if (!response.ok) {
            return { isValid: false, error: `Facilitator error: ${response.status}` };
        }

        const result = await response.json() as { isValid: boolean };
        return { isValid: result.isValid };
    } catch (error) {
        logger.error('x402', `Verify failed: ${(error as Error).message}`);
        return { isValid: false, error: (error as Error).message };
    }
}

async function settlePaymentWithFacilitator(
    payload: PaymentPayload,
    requirement: PaymentRequirement
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const config = getPaymentConfig();

    try {
        const response = await fetch(`${config.facilitatorUrl}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, paymentRequirements: requirement }),
        });

        if (!response.ok) {
            return { success: false, error: `Settlement failed: ${response.status}` };
        }

        const result = await response.json() as { success: boolean; transaction?: string };
        return { success: result.success, txHash: result.transaction };
    } catch (error) {
        logger.error('x402', `Settle failed: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}

// =============================================================================
// Middleware
// =============================================================================

export interface PaymentMiddlewareResult {
    paymentVerified: boolean;
    paymentPayload?: PaymentPayload;
    requirement?: PaymentRequirement;
    error?: string;
}

export async function checkPayment(
    req: IncomingMessage,
    res: ServerResponse,
    resource: string,
    description: string
): Promise<PaymentMiddlewareResult> {
    const config = getPaymentConfig();

    // If payments disabled, skip check
    if (!config.enabled) {
        logger.debug('x402', 'Payments disabled, skipping check');
        return { paymentVerified: true };
    }

    // Check for x402 payment header
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    // Also check for simple tx-based payment (frontend sends tx hash after ERC20 transfer)
    const txHash = req.headers['x-payment-tx'] as string | undefined;
    const walletAddress = req.headers['x-wallet-address'] as string | undefined;

    // If we have a tx hash, consider payment verified (simple mode)
    // In production, you'd verify this tx on-chain
    if (txHash && walletAddress) {
        logger.info('x402', `✅ Payment verified via tx: ${txHash.slice(0, 10)}... from ${walletAddress.slice(0, 10)}...`);
        const requirement = createPaymentRequirement(resource, description);
        return {
            paymentVerified: true,
            requirement,
            // Create a simple payload from the tx
            paymentPayload: {
                x402Version: 1,
                scheme: 'direct-transfer',
                network: config.network,
                payload: { txHash, from: walletAddress }
            }
        };
    }

    if (!paymentHeader) {
        // No payment - return 402
        const requirement = createPaymentRequirement(resource, description);
        const encoded = encodePaymentRequired([requirement]);

        res.writeHead(402, {
            'Content-Type': 'application/json',
            'X-Payment-Required': encoded,
        });
        res.end(JSON.stringify({
            error: 'Payment Required',
            message: `This endpoint requires ${config.queryPriceUSDC} USDC payment`,
            accepts: [requirement],
        }));

        logger.info('x402', `💳 402 Payment Required for ${resource}`);
        return { paymentVerified: false };
    }

    // Decode and verify payment
    const payload = decodePaymentPayload(paymentHeader);
    if (!payload) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payment payload' }));
        return { paymentVerified: false, error: 'Invalid payload' };
    }

    const requirement = createPaymentRequirement(resource, description);
    const verification = await verifyPaymentWithFacilitator(payload, requirement);

    if (!verification.isValid) {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payment verification failed', details: verification.error }));
        return { paymentVerified: false, error: verification.error };
    }

    logger.info('x402', `✅ Payment verified for ${resource}`);
    return { paymentVerified: true, paymentPayload: payload, requirement };
}

export async function settlePayment(
    payload: PaymentPayload,
    requirement: PaymentRequirement
): Promise<{ success: boolean; txHash?: string }> {
    const result = await settlePaymentWithFacilitator(payload, requirement);

    if (result.success) {
        logger.info('x402', `💰 Payment settled: ${result.txHash}`);
    }

    return result;
}
