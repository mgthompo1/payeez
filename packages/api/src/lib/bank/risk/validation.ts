/**
 * Bank Transfer Risk Validation
 *
 * Risk checks performed at transfer time instead of account creation.
 */

import type {
  BankAccount,
  BankMandate,
  BankTransfer,
  RiskCheckResult,
  VelocityCheck,
  TransferDirection,
} from '../types';
import { ACH_RETURN_CODES } from '../types';

// ============================================
// Risk Configuration
// ============================================

export interface RiskConfig {
  // Velocity limits
  max_daily_transfers: number;
  max_daily_amount: number;  // In cents
  max_monthly_transfers: number;
  max_monthly_amount: number;

  // Per-transfer limits
  max_single_transfer: number;
  min_single_transfer: number;

  // First transfer restrictions
  first_transfer_max: number;
  first_transfer_hold_days: number;

  // Risk score thresholds
  block_threshold: number;  // Block if score >= this
  review_threshold: number; // Flag for review if score >= this
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  max_daily_transfers: 10,
  max_daily_amount: 100000_00,  // $100,000
  max_monthly_transfers: 50,
  max_monthly_amount: 500000_00, // $500,000
  max_single_transfer: 50000_00, // $50,000
  min_single_transfer: 100,      // $1.00
  first_transfer_max: 5000_00,   // $5,000
  first_transfer_hold_days: 3,
  block_threshold: 80,
  review_threshold: 50,
};

// ============================================
// Risk Check Functions
// ============================================

/**
 * Check if account is on negative list.
 */
export async function checkNegativeList(
  supabase: any,
  routingHash: string,
  accountHash: string
): Promise<RiskCheckResult> {
  const { data, error } = await supabase
    .rpc('is_negative_account', {
      p_routing_hash: routingHash,
      p_account_hash: accountHash,
    });

  if (error) {
    console.error('Negative list check error:', error);
    return {
      passed: true, // Fail open
      score: 0,
      flags: ['negative_list_check_failed'],
      details: { error: error.message },
    };
  }

  if (data === true) {
    return {
      passed: false,
      score: 100,
      flags: ['negative_list_match'],
      details: { blocked: true },
    };
  }

  return {
    passed: true,
    score: 0,
    flags: [],
    details: {},
  };
}

/**
 * Check velocity limits.
 */
export async function checkVelocity(
  supabase: any,
  bankAccountId: string,
  direction: TransferDirection,
  amount: number,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): Promise<RiskCheckResult & { velocity: VelocityCheck }> {
  // Get daily total
  const { data: dailyTotal } = await supabase
    .rpc('get_daily_transfer_total', {
      p_bank_account_id: bankAccountId,
      p_direction: direction,
    });

  // Get monthly total
  const { data: monthlyTotal } = await supabase
    .rpc('get_monthly_transfer_total', {
      p_bank_account_id: bankAccountId,
      p_direction: direction,
    });

  // Get transfer counts
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);

  const { count: dailyCount } = await supabase
    .from('bank_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccountId)
    .eq('direction', direction)
    .gte('initiated_at', today)
    .not('status', 'in', '("failed","returned")');

  const { count: monthlyCount } = await supabase
    .from('bank_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccountId)
    .eq('direction', direction)
    .gte('initiated_at', monthStart.toISOString())
    .not('status', 'in', '("failed","returned")');

  const velocity: VelocityCheck = {
    daily_count: dailyCount || 0,
    daily_amount: (dailyTotal || 0) + amount,
    monthly_count: monthlyCount || 0,
    monthly_amount: (monthlyTotal || 0) + amount,
    daily_limit_count: config.max_daily_transfers,
    daily_limit_amount: config.max_daily_amount,
    monthly_limit_count: config.max_monthly_transfers,
    monthly_limit_amount: config.max_monthly_amount,
  };

  const flags: string[] = [];
  let score = 0;

  // Check limits
  if (velocity.daily_count >= config.max_daily_transfers) {
    flags.push('daily_count_exceeded');
    score += 30;
  }

  if (velocity.daily_amount > config.max_daily_amount) {
    flags.push('daily_amount_exceeded');
    score += 40;
  }

  if (velocity.monthly_count >= config.max_monthly_transfers) {
    flags.push('monthly_count_exceeded');
    score += 20;
  }

  if (velocity.monthly_amount > config.max_monthly_amount) {
    flags.push('monthly_amount_exceeded');
    score += 30;
  }

  return {
    passed: score < config.block_threshold,
    score,
    flags,
    details: { velocity },
    velocity,
  };
}

/**
 * Check mandate limits.
 */
export function checkMandateLimits(
  mandate: BankMandate,
  amount: number,
  dailyTotal: number,
  monthlyTotal: number
): RiskCheckResult {
  const flags: string[] = [];
  let score = 0;

  // Check per-transfer limit
  if (mandate.amount_limit && amount > mandate.amount_limit) {
    flags.push('mandate_amount_exceeded');
    score += 100;
  }

  // Check daily limit
  if (mandate.daily_limit && (dailyTotal + amount) > mandate.daily_limit) {
    flags.push('mandate_daily_exceeded');
    score += 100;
  }

  // Check monthly limit
  if (mandate.monthly_limit && (monthlyTotal + amount) > mandate.monthly_limit) {
    flags.push('mandate_monthly_exceeded');
    score += 100;
  }

  // Check mandate status
  if (mandate.status !== 'active') {
    flags.push('mandate_not_active');
    score += 100;
  }

  // Check expiry
  if (mandate.expires_at && new Date(mandate.expires_at) < new Date()) {
    flags.push('mandate_expired');
    score += 100;
  }

  return {
    passed: score === 0,
    score,
    flags,
    details: {
      mandate_id: mandate.id,
      amount_limit: mandate.amount_limit,
      daily_limit: mandate.daily_limit,
      monthly_limit: mandate.monthly_limit,
    },
  };
}

/**
 * Check if this is a first transfer (higher scrutiny).
 */
export async function checkFirstTransfer(
  supabase: any,
  bankAccountId: string,
  amount: number,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): Promise<RiskCheckResult> {
  const { count } = await supabase
    .from('bank_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'settled');

  const isFirst = (count || 0) === 0;
  const flags: string[] = [];
  let score = 0;

  if (isFirst) {
    flags.push('first_transfer');
    score += 10;

    if (amount > config.first_transfer_max) {
      flags.push('first_transfer_amount_high');
      score += 30;
    }
  }

  return {
    passed: true, // Don't block, just flag
    score,
    flags,
    details: { is_first_transfer: isFirst },
  };
}

/**
 * Check account verification status.
 */
export function checkVerificationStatus(account: BankAccount): RiskCheckResult {
  const flags: string[] = [];
  let score = 0;

  if (account.verification_status !== 'verified') {
    flags.push('account_not_verified');
    score += 50;
  }

  if (account.verification_method === 'manual') {
    flags.push('manual_verification');
    score += 10;
  }

  if (!account.is_active) {
    flags.push('account_inactive');
    score += 100;
  }

  return {
    passed: account.is_active && account.verification_status === 'verified',
    score,
    flags,
    details: {
      verification_status: account.verification_status,
      verification_method: account.verification_method,
    },
  };
}

/**
 * Check account return history.
 */
export async function checkReturnHistory(
  supabase: any,
  bankAccountId: string
): Promise<RiskCheckResult> {
  // Get returns in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: returns } = await supabase
    .from('bank_transfers')
    .select('return_code, return_reason')
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'returned')
    .gte('returned_at', ninetyDaysAgo.toISOString());

  const flags: string[] = [];
  let score = 0;

  if (returns && returns.length > 0) {
    flags.push('has_returns');
    score += returns.length * 15;

    // Check for specific high-risk return codes
    for (const r of returns) {
      if (['R02', 'R03', 'R04', 'R07', 'R10'].includes(r.return_code)) {
        flags.push(`high_risk_return_${r.return_code}`);
        score += 30;
      }
    }
  }

  return {
    passed: score < 80,
    score: Math.min(score, 100),
    flags,
    details: {
      return_count: returns?.length || 0,
      return_codes: returns?.map((r: any) => r.return_code) || [],
    },
  };
}

// ============================================
// Combined Risk Assessment
// ============================================

export interface RiskAssessmentInput {
  account: BankAccount;
  mandate?: BankMandate;
  amount: number;
  direction: TransferDirection;
  config?: RiskConfig;
}

export interface RiskAssessmentResult {
  approved: boolean;
  requires_review: boolean;
  total_score: number;
  checks: Record<string, RiskCheckResult>;
  all_flags: string[];
  recommendation: 'approve' | 'review' | 'block';
}

export async function assessTransferRisk(
  supabase: any,
  input: RiskAssessmentInput
): Promise<RiskAssessmentResult> {
  const { account, mandate, amount, direction, config = DEFAULT_RISK_CONFIG } = input;

  const checks: Record<string, RiskCheckResult> = {};

  // 1. Verification status
  checks.verification = checkVerificationStatus(account);

  // 2. Negative list
  if (account.routing_hash && account.account_hash) {
    checks.negative_list = await checkNegativeList(
      supabase,
      account.routing_hash,
      account.account_hash
    );
  }

  // 3. Velocity
  const velocityResult = await checkVelocity(
    supabase,
    account.id,
    direction,
    amount,
    config
  );
  checks.velocity = velocityResult;

  // 4. First transfer
  checks.first_transfer = await checkFirstTransfer(supabase, account.id, amount, config);

  // 5. Return history
  checks.return_history = await checkReturnHistory(supabase, account.id);

  // 6. Mandate limits (if mandate provided)
  if (mandate) {
    const dailyTotal = await supabase.rpc('get_daily_transfer_total', {
      p_bank_account_id: account.id,
      p_direction: direction,
    });
    const monthlyTotal = await supabase.rpc('get_monthly_transfer_total', {
      p_bank_account_id: account.id,
      p_direction: direction,
    });

    checks.mandate = checkMandateLimits(
      mandate,
      amount,
      dailyTotal.data || 0,
      monthlyTotal.data || 0
    );
  }

  // Aggregate results
  const allFlags: string[] = [];
  let totalScore = 0;
  let anyFailed = false;

  for (const [name, result] of Object.entries(checks)) {
    totalScore += result.score;
    allFlags.push(...result.flags);
    if (!result.passed) {
      anyFailed = true;
    }
  }

  // Normalize score to 0-100
  totalScore = Math.min(totalScore, 100);

  // Determine recommendation
  let recommendation: 'approve' | 'review' | 'block';
  if (anyFailed || totalScore >= config.block_threshold) {
    recommendation = 'block';
  } else if (totalScore >= config.review_threshold) {
    recommendation = 'review';
  } else {
    recommendation = 'approve';
  }

  return {
    approved: recommendation === 'approve',
    requires_review: recommendation === 'review',
    total_score: totalScore,
    checks,
    all_flags: [...new Set(allFlags)],
    recommendation,
  };
}

// ============================================
// Return Code Processing
// ============================================

export interface ReturnAction {
  action: string;
  should_disable_account: boolean;
  should_revoke_mandate: boolean;
  should_retry: boolean;
  add_to_negative_list: boolean;
}

export function processReturnCode(returnCode: string): ReturnAction {
  const codeInfo = ACH_RETURN_CODES[returnCode];

  if (!codeInfo) {
    return {
      action: 'review',
      should_disable_account: false,
      should_revoke_mandate: false,
      should_retry: false,
      add_to_negative_list: false,
    };
  }

  return {
    action: codeInfo.action,
    should_disable_account: codeInfo.action === 'disable_account',
    should_revoke_mandate: codeInfo.action === 'revoke_mandate',
    should_retry: codeInfo.action === 'retry',
    add_to_negative_list: ['R02', 'R03', 'R04'].includes(returnCode),
  };
}

/**
 * Record a risk event.
 */
export async function recordRiskEvent(
  supabase: any,
  tenantId: string,
  bankAccountId: string | null,
  transferId: string | null,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from('bank_risk_events').insert({
    tenant_id: tenantId,
    bank_account_id: bankAccountId,
    transfer_id: transferId,
    event_type: eventType,
    severity,
    description,
    details,
  });
}
