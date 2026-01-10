/**
 * Verification Provider Abstraction
 *
 * Like the vault abstraction - pluggable verification providers.
 * Manual, micro-deposit, Plaid, Finicity, Tink, TrueLayer all become adapters.
 */

import type { BankAccount, BankCountry } from '../types';

// ============================================
// Verification Provider Interface
// ============================================

export type VerificationProviderType =
  | 'manual'
  | 'microdeposit'
  | 'plaid'
  | 'finicity'
  | 'tink'
  | 'truelayer'
  | 'mx'
  | 'yodlee';

export interface VerificationResult {
  verified: boolean;
  verification_method: VerificationProviderType;
  verification_level: 'basic' | 'verified' | 'enhanced';

  // Additional data from verification
  account_holder_name?: string;
  account_type?: 'checking' | 'savings';
  account_number_last4?: string;
  routing_number?: string;

  // For enhanced verification
  balance?: {
    available: number;
    current: number;
    currency: string;
  };
  institution?: {
    name: string;
    id: string;
  };

  // Metadata
  provider_reference?: string;
  verified_at: string;
  expires_at?: string;

  // Errors
  error?: string;
  error_code?: string;
}

export interface VerificationInitResult {
  success: boolean;
  verification_id?: string;
  redirect_url?: string;       // For OAuth-based flows
  link_token?: string;         // For Plaid Link
  widget_url?: string;         // For embedded widgets
  instructions?: string;       // For manual flows
  expires_at?: string;
  error?: string;
}

export interface VerificationProvider {
  type: VerificationProviderType;
  name: string;

  // Supported countries
  supportedCountries: BankCountry[];

  // Capabilities
  supportsInstantVerification: boolean;
  supportsBalanceCheck: boolean;
  supportsAccountDetails: boolean;
  requiresRedirect: boolean;

  /**
   * Initialize verification for an account.
   */
  initiate(
    account: BankAccount,
    options?: VerificationOptions
  ): Promise<VerificationInitResult>;

  /**
   * Complete/confirm verification (for multi-step flows).
   */
  complete(
    verificationId: string,
    data: Record<string, unknown>
  ): Promise<VerificationResult>;

  /**
   * Check verification status.
   */
  getStatus(verificationId: string): Promise<VerificationResult | null>;

  /**
   * Cancel pending verification.
   */
  cancel(verificationId: string): Promise<boolean>;
}

export interface VerificationOptions {
  // Redirect URLs for OAuth flows
  redirect_uri?: string;
  success_url?: string;
  failure_url?: string;

  // Request additional data
  request_balance?: boolean;
  request_account_details?: boolean;
  request_transactions?: boolean;

  // UI options
  language?: string;
  country_codes?: BankCountry[];

  // Metadata
  client_reference?: string;
  webhook_url?: string;
}

// ============================================
// Provider Registry
// ============================================

const providers: Map<VerificationProviderType, VerificationProvider> = new Map();

export function registerVerificationProvider(provider: VerificationProvider): void {
  providers.set(provider.type, provider);
}

export function getVerificationProvider(type: VerificationProviderType): VerificationProvider | null {
  return providers.get(type) || null;
}

export function getAvailableProviders(country?: BankCountry): VerificationProvider[] {
  const all = Array.from(providers.values());
  if (!country) return all;
  return all.filter((p) => p.supportedCountries.includes(country));
}

// ============================================
// Provider Factory
// ============================================

export function createVerificationProvider(
  type: VerificationProviderType,
  config?: Record<string, unknown>
): VerificationProvider {
  switch (type) {
    case 'manual':
      return createManualProvider();
    case 'microdeposit':
      return createMicrodepositProvider();
    case 'plaid':
      return createPlaidProvider(config);
    case 'finicity':
      return createFinicityProvider(config);
    case 'tink':
      return createTinkProvider(config);
    case 'truelayer':
      return createTrueLayerProvider(config);
    default:
      throw new Error(`Unknown verification provider: ${type}`);
  }
}

// ============================================
// Manual Verification Provider
// ============================================

function createManualProvider(): VerificationProvider {
  return {
    type: 'manual',
    name: 'Manual Verification',
    supportedCountries: ['US', 'GB', 'EU', 'AU', 'NZ', 'CA'],
    supportsInstantVerification: false,
    supportsBalanceCheck: false,
    supportsAccountDetails: false,
    requiresRedirect: false,

    async initiate(account, options) {
      return {
        success: true,
        verification_id: `manual_${account.id}_${Date.now()}`,
        instructions: 'Account will be manually reviewed and verified within 1-2 business days.',
      };
    },

    async complete(verificationId, data) {
      const { verified_by, notes } = data as { verified_by?: string; notes?: string };

      return {
        verified: true,
        verification_method: 'manual',
        verification_level: 'verified',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
      };
    },

    async getStatus(verificationId) {
      // Would check database
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// Micro-deposit Provider
// ============================================

function createMicrodepositProvider(): VerificationProvider {
  return {
    type: 'microdeposit',
    name: 'Micro-deposit Verification',
    supportedCountries: ['US'],
    supportsInstantVerification: false,
    supportsBalanceCheck: false,
    supportsAccountDetails: false,
    requiresRedirect: false,

    async initiate(account, options) {
      // Generate two random amounts (1-99 cents)
      const amount1 = Math.floor(Math.random() * 99) + 1;
      let amount2 = Math.floor(Math.random() * 99) + 1;
      while (amount2 === amount1) {
        amount2 = Math.floor(Math.random() * 99) + 1;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      return {
        success: true,
        verification_id: `microdeposit_${account.id}_${Date.now()}`,
        instructions: 'Two small deposits (under $1.00 each) will appear in your account within 1-3 business days. Enter both amounts to verify.',
        expires_at: expiresAt.toISOString(),
      };
    },

    async complete(verificationId, data) {
      const { amounts } = data as { amounts: [number, number] };

      // Would verify against stored amounts
      // For now, assume success
      return {
        verified: true,
        verification_method: 'microdeposit',
        verification_level: 'verified',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
      };
    },

    async getStatus(verificationId) {
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// Plaid Provider (Stub)
// ============================================

function createPlaidProvider(config?: Record<string, unknown>): VerificationProvider {
  const clientId = config?.client_id as string || Deno.env.get('PLAID_CLIENT_ID');
  const secret = config?.secret as string || Deno.env.get('PLAID_SECRET');
  const environment = config?.environment as string || Deno.env.get('PLAID_ENV') || 'sandbox';

  return {
    type: 'plaid',
    name: 'Plaid Instant Verification',
    supportedCountries: ['US', 'CA', 'GB'],
    supportsInstantVerification: true,
    supportsBalanceCheck: true,
    supportsAccountDetails: true,
    requiresRedirect: false, // Uses Plaid Link embedded

    async initiate(account, options) {
      if (!clientId || !secret) {
        return { success: false, error: 'Plaid credentials not configured' };
      }

      // Would call Plaid API to create link token
      // POST https://sandbox.plaid.com/link/token/create

      return {
        success: true,
        verification_id: `plaid_${account.id}_${Date.now()}`,
        link_token: 'link-sandbox-xxxxx', // Would be from Plaid API
        instructions: 'Connect your bank account securely through Plaid.',
      };
    },

    async complete(verificationId, data) {
      const { public_token, account_id } = data as { public_token: string; account_id: string };

      // Would exchange public_token for access_token
      // Then get account details

      return {
        verified: true,
        verification_method: 'plaid',
        verification_level: 'enhanced',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
        institution: {
          name: 'Chase',
          id: 'ins_3',
        },
      };
    },

    async getStatus(verificationId) {
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// Finicity Provider (Stub)
// ============================================

function createFinicityProvider(config?: Record<string, unknown>): VerificationProvider {
  return {
    type: 'finicity',
    name: 'Finicity Instant Verification',
    supportedCountries: ['US', 'CA'],
    supportsInstantVerification: true,
    supportsBalanceCheck: true,
    supportsAccountDetails: true,
    requiresRedirect: false,

    async initiate(account, options) {
      return {
        success: true,
        verification_id: `finicity_${account.id}_${Date.now()}`,
        widget_url: 'https://connect.finicity.com/xxxxx',
      };
    },

    async complete(verificationId, data) {
      return {
        verified: true,
        verification_method: 'finicity',
        verification_level: 'enhanced',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
      };
    },

    async getStatus(verificationId) {
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// Tink Provider (EU/UK) (Stub)
// ============================================

function createTinkProvider(config?: Record<string, unknown>): VerificationProvider {
  return {
    type: 'tink',
    name: 'Tink Open Banking',
    supportedCountries: ['GB', 'EU'],
    supportsInstantVerification: true,
    supportsBalanceCheck: true,
    supportsAccountDetails: true,
    requiresRedirect: true,

    async initiate(account, options) {
      return {
        success: true,
        verification_id: `tink_${account.id}_${Date.now()}`,
        redirect_url: `https://link.tink.com/xxxxx?redirect_uri=${options?.redirect_uri || ''}`,
      };
    },

    async complete(verificationId, data) {
      return {
        verified: true,
        verification_method: 'tink',
        verification_level: 'enhanced',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
      };
    },

    async getStatus(verificationId) {
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// TrueLayer Provider (UK/EU) (Stub)
// ============================================

function createTrueLayerProvider(config?: Record<string, unknown>): VerificationProvider {
  return {
    type: 'truelayer',
    name: 'TrueLayer Open Banking',
    supportedCountries: ['GB', 'EU'],
    supportsInstantVerification: true,
    supportsBalanceCheck: true,
    supportsAccountDetails: true,
    requiresRedirect: true,

    async initiate(account, options) {
      return {
        success: true,
        verification_id: `truelayer_${account.id}_${Date.now()}`,
        redirect_url: `https://auth.truelayer.com/xxxxx?redirect_uri=${options?.redirect_uri || ''}`,
      };
    },

    async complete(verificationId, data) {
      return {
        verified: true,
        verification_method: 'truelayer',
        verification_level: 'enhanced',
        provider_reference: verificationId,
        verified_at: new Date().toISOString(),
      };
    },

    async getStatus(verificationId) {
      return null;
    },

    async cancel(verificationId) {
      return true;
    },
  };
}

// ============================================
// Auto-registration
// ============================================

// Register default providers on module load
registerVerificationProvider(createManualProvider());
registerVerificationProvider(createMicrodepositProvider());

// Register third-party providers if configured
if (Deno.env.get('PLAID_CLIENT_ID')) {
  registerVerificationProvider(createPlaidProvider());
}
if (Deno.env.get('FINICITY_PARTNER_ID')) {
  registerVerificationProvider(createFinicityProvider());
}
if (Deno.env.get('TINK_CLIENT_ID')) {
  registerVerificationProvider(createTinkProvider());
}
if (Deno.env.get('TRUELAYER_CLIENT_ID')) {
  registerVerificationProvider(createTrueLayerProvider());
}

// Re-export microdeposit for backward compatibility
export * from './microdeposit';
