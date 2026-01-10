/**
 * Bank Account Capabilities
 *
 * Account-level capability detection for rail selection and validation.
 * Critical for international support where accounts have different abilities.
 */

import type { BankCountry, TransferDirection } from './types';
import type { SettlementType } from './settlement/strategy';

// ============================================
// Capability Types
// ============================================

export interface AccountCapabilities {
  // Core abilities
  can_debit: boolean;
  can_credit: boolean;

  // Supported rails (determined by country + account type + verification)
  supported_rails: SettlementType[];

  // Verification status
  verified: boolean;
  verified_via: VerificationMethod | null;
  verification_level: VerificationLevel;

  // Limits (account-specific, may differ from strategy limits)
  debit_limit_cents: number | null;
  credit_limit_cents: number | null;
  daily_limit_cents: number | null;

  // Restrictions
  restrictions: AccountRestriction[];

  // Metadata
  last_verified_at: string | null;
  capabilities_updated_at: string;
}

export type VerificationMethod =
  | 'microdeposit'
  | 'instant_verification'  // Plaid/Finicity instant
  | 'open_banking'          // UK/EU Open Banking
  | 'manual'                // Manual review
  | 'database'              // Bureau/database check
  | 'prenote';              // Zero-dollar prenote

export type VerificationLevel =
  | 'none'        // Not verified
  | 'basic'       // Routing/account format valid
  | 'verified'    // Ownership verified
  | 'enhanced';   // Enhanced verification (balance, name match, etc.)

export type AccountRestriction =
  | 'no_debits'           // Credit-only account
  | 'no_credits'          // Debit-only account
  | 'business_only'       // Only B2B transactions
  | 'consumer_only'       // Only B2C transactions
  | 'domestic_only'       // No international
  | 'same_day_blocked'    // Cannot use same-day ACH
  | 'instant_blocked'     // Cannot use instant rails
  | 'amount_restricted'   // Lower than normal limits
  | 'review_required'     // Manual review on each transfer
  | 'suspended';          // Temporarily blocked

// ============================================
// Country-based Rail Mapping
// ============================================

const COUNTRY_RAILS: Record<BankCountry, SettlementType[]> = {
  US: ['nacha', 'stripe_ach', 'dwolla', 'moov', 'rtp', 'fednow'],
  GB: ['faster_payments', 'bacs', 'open_banking'],
  EU: ['sepa', 'sepa_instant', 'open_banking'],
  AU: ['npp', 'eft'],
  NZ: ['eft'],
  CA: ['eft'],
};

const DEBIT_CAPABLE_RAILS: SettlementType[] = [
  'nacha',
  'stripe_ach',
  'dwolla',
  'moov',
  'bacs',
  'faster_payments',
  'open_banking',
];

const CREDIT_ONLY_RAILS: SettlementType[] = [
  'rtp',
  'fednow',
  'sepa',
  'sepa_instant',
  'npp',
];

// ============================================
// Capability Detection
// ============================================

export interface CapabilityDetectionInput {
  country: BankCountry;
  account_type: 'checking' | 'savings';
  verification_status: 'unverified' | 'pending' | 'verified' | 'failed';
  verification_method?: string | null;
  is_business?: boolean;
  return_history?: { count: number; codes: string[] };
  metadata?: Record<string, unknown>;
}

/**
 * Detect capabilities for a bank account based on its attributes.
 */
export function detectCapabilities(input: CapabilityDetectionInput): AccountCapabilities {
  const {
    country,
    account_type,
    verification_status,
    verification_method,
    is_business,
    return_history,
  } = input;

  // Base rails for country
  let supported_rails = [...(COUNTRY_RAILS[country] || [])];

  // Determine debit/credit capability
  let can_debit = supported_rails.some((r) => DEBIT_CAPABLE_RAILS.includes(r));
  let can_credit = true; // All accounts can receive credits

  // Savings accounts often have debit restrictions
  if (account_type === 'savings') {
    // US Regulation D limits savings withdrawals
    if (country === 'US') {
      can_debit = false;
      supported_rails = supported_rails.filter((r) => CREDIT_ONLY_RAILS.includes(r) || r === 'nacha');
    }
  }

  // Verification level
  let verification_level: VerificationLevel = 'none';
  let verified = false;

  if (verification_status === 'verified') {
    verified = true;
    verification_level = verification_method === 'instant_verification' || verification_method === 'open_banking'
      ? 'enhanced'
      : 'verified';
  } else if (verification_status === 'pending') {
    verification_level = 'basic';
  }

  // Without verification, restrict to credit-only on most rails
  if (!verified) {
    can_debit = false;
    // Remove instant rails that require verification
    supported_rails = supported_rails.filter((r) => !['rtp', 'fednow', 'sepa_instant', 'npp'].includes(r));
  }

  // Determine restrictions
  const restrictions: AccountRestriction[] = [];

  if (!can_debit) {
    restrictions.push('no_debits');
  }

  if (return_history && return_history.count > 0) {
    // Check for problematic return codes
    const highRiskCodes = ['R02', 'R03', 'R04', 'R07', 'R10', 'R29'];
    const hasHighRisk = return_history.codes.some((c) => highRiskCodes.includes(c));

    if (hasHighRisk) {
      restrictions.push('review_required');
      restrictions.push('instant_blocked');
      // Remove instant rails
      supported_rails = supported_rails.filter((r) => !['rtp', 'fednow', 'sepa_instant', 'faster_payments', 'npp'].includes(r));
    }

    if (return_history.count >= 3) {
      restrictions.push('amount_restricted');
    }
  }

  // Business vs consumer
  if (is_business === false) {
    // Consumer accounts may have lower limits
    restrictions.push('amount_restricted');
  }

  // Default limits (can be overridden by mandate)
  const debit_limit_cents = can_debit ? (is_business ? 100_000_00 : 25_000_00) : 0;
  const credit_limit_cents = is_business ? 1_000_000_00 : 100_000_00;
  const daily_limit_cents = is_business ? 500_000_00 : 50_000_00;

  return {
    can_debit,
    can_credit,
    supported_rails,
    verified,
    verified_via: verification_method as VerificationMethod | null,
    verification_level,
    debit_limit_cents,
    credit_limit_cents,
    daily_limit_cents,
    restrictions,
    last_verified_at: verified ? new Date().toISOString() : null,
    capabilities_updated_at: new Date().toISOString(),
  };
}

// ============================================
// Capability Checks
// ============================================

/**
 * Check if an account can perform a specific transfer.
 */
export function canPerformTransfer(
  capabilities: AccountCapabilities,
  direction: TransferDirection,
  amount_cents: number,
  rail?: SettlementType
): { allowed: boolean; reason?: string } {
  // Direction check
  if (direction === 'debit' && !capabilities.can_debit) {
    return { allowed: false, reason: 'Account cannot be debited' };
  }

  if (direction === 'credit' && !capabilities.can_credit) {
    return { allowed: false, reason: 'Account cannot receive credits' };
  }

  // Rail check
  if (rail && !capabilities.supported_rails.includes(rail)) {
    return { allowed: false, reason: `Rail ${rail} not supported for this account` };
  }

  // Amount checks
  if (direction === 'debit' && capabilities.debit_limit_cents !== null) {
    if (amount_cents > capabilities.debit_limit_cents) {
      return { allowed: false, reason: `Amount exceeds debit limit of ${capabilities.debit_limit_cents / 100}` };
    }
  }

  if (direction === 'credit' && capabilities.credit_limit_cents !== null) {
    if (amount_cents > capabilities.credit_limit_cents) {
      return { allowed: false, reason: `Amount exceeds credit limit of ${capabilities.credit_limit_cents / 100}` };
    }
  }

  // Restriction checks
  if (capabilities.restrictions.includes('suspended')) {
    return { allowed: false, reason: 'Account is suspended' };
  }

  if (rail && ['rtp', 'fednow', 'sepa_instant', 'npp'].includes(rail)) {
    if (capabilities.restrictions.includes('instant_blocked')) {
      return { allowed: false, reason: 'Instant transfers blocked for this account' };
    }
  }

  return { allowed: true };
}

/**
 * Get the best available rail for a transfer.
 */
export function selectBestRail(
  capabilities: AccountCapabilities,
  direction: TransferDirection,
  priority: 'cost' | 'speed'
): SettlementType | null {
  // Filter rails by direction
  let eligibleRails = capabilities.supported_rails;

  if (direction === 'debit') {
    eligibleRails = eligibleRails.filter((r) => DEBIT_CAPABLE_RAILS.includes(r));
  }

  if (eligibleRails.length === 0) {
    return null;
  }

  // Sort by priority
  if (priority === 'speed') {
    // Instant rails first
    const instantRails = eligibleRails.filter((r) =>
      ['rtp', 'fednow', 'faster_payments', 'sepa_instant', 'npp'].includes(r)
    );
    if (instantRails.length > 0) {
      return instantRails[0];
    }
  }

  // Default: return first available (typically cheapest)
  return eligibleRails[0];
}

// ============================================
// Capability Refresh
// ============================================

/**
 * Determine if capabilities should be refreshed.
 */
export function shouldRefreshCapabilities(
  capabilities: AccountCapabilities,
  maxAgeHours = 24
): boolean {
  const updatedAt = new Date(capabilities.capabilities_updated_at);
  const now = new Date();
  const ageHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}

/**
 * Merge capability updates (e.g., after verification).
 */
export function updateCapabilities(
  existing: AccountCapabilities,
  updates: Partial<AccountCapabilities>
): AccountCapabilities {
  return {
    ...existing,
    ...updates,
    capabilities_updated_at: new Date().toISOString(),
  };
}
