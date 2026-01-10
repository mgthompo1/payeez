/**
 * Micro-deposit Verification
 *
 * Verify bank accounts by sending two small deposits (1-99 cents)
 * and asking the user to confirm the amounts.
 */

import { randomInt } from 'node:crypto';
import type { BankAccount, MicrodepositVerification } from '../types';

// ============================================
// Configuration
// ============================================

export interface MicrodepositConfig {
  // Amount range (in cents)
  min_amount: number;
  max_amount: number;

  // Verification
  max_attempts: number;
  expiry_days: number;

  // Retry
  resend_cooldown_hours: number;
}

export const DEFAULT_MICRODEPOSIT_CONFIG: MicrodepositConfig = {
  min_amount: 1,   // $0.01
  max_amount: 99,  // $0.99
  max_attempts: 3,
  expiry_days: 7,
  resend_cooldown_hours: 24,
};

// ============================================
// Generate Micro-deposits
// ============================================

export interface MicrodepositAmounts {
  amount_1: number;
  amount_2: number;
}

/**
 * Generate two random micro-deposit amounts.
 */
export function generateMicrodepositAmounts(
  config: MicrodepositConfig = DEFAULT_MICRODEPOSIT_CONFIG
): MicrodepositAmounts {
  const amount_1 = randomInt(config.min_amount, config.max_amount + 1);
  let amount_2 = randomInt(config.min_amount, config.max_amount + 1);

  // Ensure amounts are different
  while (amount_2 === amount_1) {
    amount_2 = randomInt(config.min_amount, config.max_amount + 1);
  }

  return { amount_1, amount_2 };
}

// ============================================
// Initiate Micro-deposits
// ============================================

export interface InitiateMicrodepositResult {
  success: boolean;
  amounts?: MicrodepositAmounts;
  expires_at?: string;
  error?: string;
}

/**
 * Initiate micro-deposit verification for a bank account.
 */
export async function initiateMicrodeposits(
  supabase: any,
  bankAccountId: string,
  settlementProvider: 'nacha' | 'stripe_ach' | 'dwolla' = 'stripe_ach',
  config: MicrodepositConfig = DEFAULT_MICRODEPOSIT_CONFIG
): Promise<InitiateMicrodepositResult> {
  // Get bank account
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .single();

  if (accountError || !account) {
    return { success: false, error: 'Bank account not found' };
  }

  // Check if already verified
  if (account.verification_status === 'verified') {
    return { success: false, error: 'Account is already verified' };
  }

  // Check cooldown
  if (account.microdeposit_sent_at) {
    const sentAt = new Date(account.microdeposit_sent_at);
    const cooldownEnd = new Date(sentAt.getTime() + config.resend_cooldown_hours * 60 * 60 * 1000);
    if (new Date() < cooldownEnd) {
      return {
        success: false,
        error: `Micro-deposits already sent. Please wait until ${cooldownEnd.toISOString()} to resend.`,
      };
    }
  }

  // Generate amounts
  const amounts = generateMicrodepositAmounts(config);

  // Calculate expiry
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + config.expiry_days);

  // Update bank account
  const { error: updateError } = await supabase
    .from('bank_accounts')
    .update({
      verification_method: 'microdeposit',
      verification_status: 'pending',
      microdeposit_sent_at: new Date().toISOString(),
      microdeposit_amount_1: amounts.amount_1,
      microdeposit_amount_2: amounts.amount_2,
      microdeposit_expires_at: expires_at.toISOString(),
      verification_attempts: 0,
    })
    .eq('id', bankAccountId);

  if (updateError) {
    return { success: false, error: 'Failed to update bank account' };
  }

  // TODO: Actually send the deposits via the settlement provider
  // This would involve:
  // 1. Creating two small credit transfers
  // 2. Submitting them to the ACH network
  // For now, we just record the amounts

  console.log(`[Microdeposit] Initiated for ${bankAccountId}:`, amounts);

  return {
    success: true,
    amounts,
    expires_at: expires_at.toISOString(),
  };
}

// ============================================
// Verify Micro-deposits
// ============================================

export interface VerifyMicrodepositResult {
  success: boolean;
  verified: boolean;
  attempts_remaining?: number;
  error?: string;
}

/**
 * Verify micro-deposit amounts provided by the user.
 */
export async function verifyMicrodeposits(
  supabase: any,
  bankAccountId: string,
  userAmount1: number,
  userAmount2: number,
  config: MicrodepositConfig = DEFAULT_MICRODEPOSIT_CONFIG
): Promise<VerifyMicrodepositResult> {
  // Get bank account
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .single();

  if (accountError || !account) {
    return { success: false, verified: false, error: 'Bank account not found' };
  }

  // Check if already verified
  if (account.verification_status === 'verified') {
    return { success: true, verified: true };
  }

  // Check if micro-deposits were sent
  if (!account.microdeposit_amount_1 || !account.microdeposit_amount_2) {
    return { success: false, verified: false, error: 'Micro-deposits not initiated' };
  }

  // Check expiry
  if (account.microdeposit_expires_at && new Date(account.microdeposit_expires_at) < new Date()) {
    return { success: false, verified: false, error: 'Micro-deposits have expired' };
  }

  // Check attempts
  const attempts = (account.verification_attempts || 0) + 1;
  if (attempts > config.max_attempts) {
    // Too many failed attempts - mark as failed
    await supabase
      .from('bank_accounts')
      .update({
        verification_status: 'failed',
      })
      .eq('id', bankAccountId);

    return {
      success: false,
      verified: false,
      attempts_remaining: 0,
      error: 'Maximum verification attempts exceeded',
    };
  }

  // Verify amounts (order doesn't matter)
  const correctAmounts = [account.microdeposit_amount_1, account.microdeposit_amount_2].sort();
  const userAmounts = [userAmount1, userAmount2].sort();

  const isCorrect = correctAmounts[0] === userAmounts[0] && correctAmounts[1] === userAmounts[1];

  if (isCorrect) {
    // Mark as verified
    await supabase
      .from('bank_accounts')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        verification_attempts: attempts,
      })
      .eq('id', bankAccountId);

    return { success: true, verified: true };
  } else {
    // Wrong amounts - increment attempts
    await supabase
      .from('bank_accounts')
      .update({
        verification_attempts: attempts,
      })
      .eq('id', bankAccountId);

    return {
      success: true,
      verified: false,
      attempts_remaining: config.max_attempts - attempts,
      error: 'Incorrect amounts',
    };
  }
}

// ============================================
// Get Verification Status
// ============================================

export interface MicrodepositStatus {
  status: 'not_initiated' | 'pending' | 'verified' | 'failed' | 'expired';
  sent_at?: string;
  expires_at?: string;
  attempts: number;
  max_attempts: number;
  can_resend: boolean;
  resend_available_at?: string;
}

export async function getMicrodepositStatus(
  supabase: any,
  bankAccountId: string,
  config: MicrodepositConfig = DEFAULT_MICRODEPOSIT_CONFIG
): Promise<MicrodepositStatus> {
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .single();

  if (!account) {
    return {
      status: 'not_initiated',
      attempts: 0,
      max_attempts: config.max_attempts,
      can_resend: false,
    };
  }

  // Check if verified
  if (account.verification_status === 'verified') {
    return {
      status: 'verified',
      sent_at: account.microdeposit_sent_at,
      attempts: account.verification_attempts || 0,
      max_attempts: config.max_attempts,
      can_resend: false,
    };
  }

  // Check if failed
  if (account.verification_status === 'failed') {
    return {
      status: 'failed',
      sent_at: account.microdeposit_sent_at,
      attempts: account.verification_attempts || 0,
      max_attempts: config.max_attempts,
      can_resend: false,
    };
  }

  // Check if not initiated
  if (!account.microdeposit_sent_at) {
    return {
      status: 'not_initiated',
      attempts: 0,
      max_attempts: config.max_attempts,
      can_resend: true,
    };
  }

  // Check if expired
  if (account.microdeposit_expires_at && new Date(account.microdeposit_expires_at) < new Date()) {
    const sentAt = new Date(account.microdeposit_sent_at);
    const resendAvailable = new Date(sentAt.getTime() + config.resend_cooldown_hours * 60 * 60 * 1000);

    return {
      status: 'expired',
      sent_at: account.microdeposit_sent_at,
      expires_at: account.microdeposit_expires_at,
      attempts: account.verification_attempts || 0,
      max_attempts: config.max_attempts,
      can_resend: new Date() >= resendAvailable,
      resend_available_at: resendAvailable.toISOString(),
    };
  }

  // Pending
  const sentAt = new Date(account.microdeposit_sent_at);
  const resendAvailable = new Date(sentAt.getTime() + config.resend_cooldown_hours * 60 * 60 * 1000);

  return {
    status: 'pending',
    sent_at: account.microdeposit_sent_at,
    expires_at: account.microdeposit_expires_at,
    attempts: account.verification_attempts || 0,
    max_attempts: config.max_attempts,
    can_resend: new Date() >= resendAvailable,
    resend_available_at: resendAvailable.toISOString(),
  };
}

// ============================================
// Manual Verification
// ============================================

/**
 * Manually verify a bank account (for B2B or trusted flows).
 */
export async function manuallyVerifyBankAccount(
  supabase: any,
  bankAccountId: string,
  verifiedBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({
      verification_method: 'manual',
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      metadata: {
        manually_verified_by: verifiedBy,
        verification_notes: notes,
      },
    })
    .eq('id', bankAccountId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
