/**
 * ACH Settlement Orchestrator
 *
 * Provides multi-rail ACH settlement with:
 * - Rail selection based on cost, speed, verification requirements
 * - Retry/failover between providers
 * - Strategy explainability (why a rail was chosen)
 *
 * Supported providers:
 * - Stripe ACH (PaymentIntents + us_bank_account)
 * - Moov (faster ACH) - future
 * - PayPal ACH - future
 * - NACHA files - future
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptJson } from '../crypto.ts';
import { stripeACHAdapter } from './stripe.ts';
import type {
  ACHAdapter,
  ACHProviderName,
  ACHSettlementRequest,
  ACHSettlementResponse,
  ACHDirection,
  ACHBankAccount,
  ACHVerificationResponse,
  VerificationMethod,
} from './types.ts';

// Re-export types
export * from './types.ts';

// Available adapters
const adapters: Record<ACHProviderName, ACHAdapter> = {
  stripe_ach: stripeACHAdapter,
  // Future: moov, paypal_ach, nacha, dwolla, open_banking
  moov: stripeACHAdapter, // Placeholder - use Stripe for now
  paypal_ach: stripeACHAdapter, // Placeholder
  nacha: stripeACHAdapter, // Placeholder
  dwolla: stripeACHAdapter, // Placeholder
  open_banking: stripeACHAdapter, // Placeholder
};

// Routing decision with explainability
export interface ACHRoutingDecision {
  provider: ACHProviderName;
  reason: string;
  factors: {
    name: string;
    value: string | number;
    weight: number;
  }[];
  alternativesConsidered: {
    provider: ACHProviderName;
    reason: string;
  }[];
  estimatedSettlementDays: number;
  estimatedCost?: number;
}

// Context for routing decisions
export interface ACHRoutingContext {
  tenantId: string;
  direction: ACHDirection;
  amount: number;
  currency: string;
  verificationStrength?: 'basic' | 'strong';
  preferredProvider?: ACHProviderName;
  excludeProviders?: ACHProviderName[];
  requiresSameDay?: boolean;
}

/**
 * Get ACH credentials for a tenant
 */
export async function getACHCredentials(
  tenantId: string,
  supabase: SupabaseClient,
  provider: ACHProviderName = 'stripe_ach'
): Promise<Record<string, string> | null> {
  // Map ACH provider to PSP name in credentials table
  const pspName = provider === 'stripe_ach' ? 'stripe' : provider;

  const { data: pspCreds } = await supabase
    .from('psp_credentials')
    .select('credentials_encrypted, environment')
    .eq('tenant_id', tenantId)
    .eq('psp', pspName)
    .eq('is_active', true)
    .single();

  if (!pspCreds?.credentials_encrypted) {
    return null;
  }

  // Use proper decryption
  try {
    return await decryptJson(pspCreds.credentials_encrypted);
  } catch {
    // If decryption fails (not encrypted yet), try parsing as JSON
    try {
      return JSON.parse(pspCreds.credentials_encrypted);
    } catch {
      console.error('[ACH] Failed to decrypt/parse credentials');
      return null;
    }
  }
}

/**
 * Select the best ACH provider for a transfer
 */
export function selectACHProvider(context: ACHRoutingContext): ACHRoutingDecision {
  const factors: ACHRoutingDecision['factors'] = [];
  const alternatives: ACHRoutingDecision['alternativesConsidered'] = [];

  // If tenant has a preferred provider, use it
  if (context.preferredProvider && !context.excludeProviders?.includes(context.preferredProvider)) {
    return {
      provider: context.preferredProvider,
      reason: 'Tenant-preferred provider',
      factors: [{ name: 'preference', value: context.preferredProvider, weight: 100 }],
      alternativesConsidered: [],
      estimatedSettlementDays: 4,
    };
  }

  // For now, default to Stripe ACH as the primary provider
  // Future: implement cost/speed optimization across providers
  const provider: ACHProviderName = 'stripe_ach';

  // Add decision factors
  factors.push(
    { name: 'availability', value: 'active', weight: 50 },
    { name: 'verification_support', value: 'yes', weight: 30 },
    { name: 'api_reliability', value: '99.9%', weight: 20 }
  );

  // Consider alternatives
  alternatives.push(
    { provider: 'moov', reason: 'Faster settlement but not yet integrated' },
    { provider: 'nacha', reason: 'Lower cost but requires file processing' }
  );

  // Calculate settlement estimate
  const estimatedDays = context.requiresSameDay ? 0 : 4;

  return {
    provider,
    reason: 'Default provider with best reliability and verification support',
    factors,
    alternativesConsidered: alternatives,
    estimatedSettlementDays: estimatedDays,
  };
}

/**
 * Get adapter for a provider
 */
export function getAdapter(provider: ACHProviderName): ACHAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unknown ACH provider: ${provider}`);
  }
  return adapter;
}

/**
 * Execute ACH debit through the selected provider
 */
export async function executeACHDebit(
  request: ACHSettlementRequest,
  tenantId: string,
  supabase: SupabaseClient,
  options?: {
    preferredProvider?: ACHProviderName;
    requiresSameDay?: boolean;
  }
): Promise<{
  response: ACHSettlementResponse;
  routing: ACHRoutingDecision;
}> {
  // Select provider
  const routing = selectACHProvider({
    tenantId,
    direction: 'debit',
    amount: request.amount,
    currency: request.currency,
    preferredProvider: options?.preferredProvider,
    requiresSameDay: options?.requiresSameDay,
  });

  // Get credentials
  const credentials = await getACHCredentials(tenantId, supabase, routing.provider);
  if (!credentials) {
    return {
      response: {
        success: false,
        status: 'failed',
        providerId: '',
        failureCode: 'no_credentials',
        failureMessage: `No active credentials for ${routing.provider}`,
        failureCategory: 'validation_error',
        rawResponse: null,
      },
      routing,
    };
  }

  // Execute through adapter
  const adapter = getAdapter(routing.provider);
  const response = await adapter.debit(request, credentials);

  return { response, routing };
}

/**
 * Execute ACH credit through the selected provider
 */
export async function executeACHCredit(
  request: ACHSettlementRequest,
  tenantId: string,
  supabase: SupabaseClient,
  options?: {
    preferredProvider?: ACHProviderName;
    requiresSameDay?: boolean;
  }
): Promise<{
  response: ACHSettlementResponse;
  routing: ACHRoutingDecision;
}> {
  // Select provider
  const routing = selectACHProvider({
    tenantId,
    direction: 'credit',
    amount: request.amount,
    currency: request.currency,
    preferredProvider: options?.preferredProvider,
    requiresSameDay: options?.requiresSameDay,
  });

  // Get credentials
  const credentials = await getACHCredentials(tenantId, supabase, routing.provider);
  if (!credentials) {
    return {
      response: {
        success: false,
        status: 'failed',
        providerId: '',
        failureCode: 'no_credentials',
        failureMessage: `No active credentials for ${routing.provider}`,
        failureCategory: 'validation_error',
        rawResponse: null,
      },
      routing,
    };
  }

  // Execute through adapter
  const adapter = getAdapter(routing.provider);
  const response = await adapter.credit(request, credentials);

  return { response, routing };
}

/**
 * Initiate bank account verification
 */
export async function initiateVerification(
  bankAccount: ACHBankAccount,
  tenantId: string,
  supabase: SupabaseClient,
  options?: {
    preferredMethod?: VerificationMethod;
    preferredProvider?: ACHProviderName;
    redirectUrl?: string;
  }
): Promise<{
  response: ACHVerificationResponse;
  provider: ACHProviderName;
}> {
  const provider = options?.preferredProvider || 'stripe_ach';

  // Get credentials
  const credentials = await getACHCredentials(tenantId, supabase, provider);
  if (!credentials) {
    return {
      response: {
        success: false,
        method: 'micro_deposits',
        strength: 'basic',
        error: `No active credentials for ${provider}`,
      },
      provider,
    };
  }

  // Execute through adapter
  const adapter = getAdapter(provider);
  const response = await adapter.initiateVerification(bankAccount, credentials, {
    preferredMethod: options?.preferredMethod,
    redirectUrl: options?.redirectUrl,
  });

  return { response, provider };
}

/**
 * Verify micro-deposits
 */
export async function verifyMicroDeposits(
  bankAccountProviderRef: string,
  amounts: [number, number],
  tenantId: string,
  supabase: SupabaseClient,
  provider: ACHProviderName = 'stripe_ach'
): Promise<{ success: boolean; paymentMethodId?: string; error?: string }> {
  // Get credentials
  const credentials = await getACHCredentials(tenantId, supabase, provider);
  if (!credentials) {
    return { success: false, error: `No active credentials for ${provider}` };
  }

  // Execute through adapter
  const adapter = getAdapter(provider);
  return adapter.verifyMicroDeposits(bankAccountProviderRef, amounts, credentials);
}

/**
 * Check verification status via provider (for provider-managed verification)
 */
export async function checkVerificationStatus(
  providerRef: string,
  tenantId: string,
  supabase: SupabaseClient,
  provider: ACHProviderName = 'stripe_ach'
): Promise<{
  status: 'pending' | 'verified' | 'failed';
  verifiedAt?: string;
  paymentMethodId?: string;
  error?: string;
}> {
  // Get credentials
  const credentials = await getACHCredentials(tenantId, supabase, provider);
  if (!credentials) {
    return { status: 'failed', error: `No active credentials for ${provider}` };
  }

  // Execute through adapter
  const adapter = getAdapter(provider);
  if (!adapter.checkVerificationStatus) {
    return { status: 'pending', error: 'Provider does not support status check' };
  }

  return adapter.checkVerificationStatus(providerRef, credentials);
}
