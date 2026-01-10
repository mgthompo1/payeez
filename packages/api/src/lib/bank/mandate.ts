/**
 * Enhanced Mandate Engine
 *
 * Mandates are authorization proof for bank transfers.
 * Required for SEPA/UK, strengthens ACH return defense.
 */

import type { BankCountry, TransferDirection } from './types';
import type { SettlementType } from './settlement/strategy';

// ============================================
// Mandate Types
// ============================================

export type MandateScope =
  | 'single'      // One-time authorization
  | 'recurring'   // Ongoing with schedule
  | 'standing'    // Open-ended (variable amount/timing)
  | 'blanket';    // Pre-authorized up to limits

export type MandateStatus =
  | 'pending'     // Awaiting signature/confirmation
  | 'active'      // Valid and usable
  | 'suspended'   // Temporarily paused
  | 'revoked'     // Cancelled by account holder
  | 'expired';    // Past expiration date

export interface MandateLimits {
  // Per-transfer limits
  max_amount_cents?: number;
  min_amount_cents?: number;

  // Aggregate limits
  daily_limit_cents?: number;
  weekly_limit_cents?: number;
  monthly_limit_cents?: number;
  yearly_limit_cents?: number;

  // Count limits
  max_transfers_per_day?: number;
  max_transfers_per_month?: number;
  total_transfer_count?: number;  // Lifetime limit

  // Total value limits
  total_amount_cents?: number;  // Lifetime value limit
}

export interface MandateSchedule {
  type: 'one_time' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  interval_days?: number;       // For custom schedules
  day_of_week?: number;         // 0-6 for weekly
  day_of_month?: number;        // 1-31 for monthly
  start_date: string;
  end_date?: string;
  next_execution_date?: string;
}

export interface MandateAuthorization {
  // Signature
  signed_at: string;
  signed_by: string;            // Name of signer
  signature_type: 'electronic' | 'written' | 'verbal' | 'click_through';
  signature_data?: string;      // Base64 signature image or reference

  // Consent tracking
  consent_text: string;         // The authorization language shown
  consent_version: string;      // Version of consent form
  consent_ip?: string;          // IP address at consent
  consent_user_agent?: string;  // Browser/device info

  // Evidence
  evidence_url?: string;        // Link to signed document
  evidence_hash?: string;       // Hash of signed document
}

export interface Mandate {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  customer_id?: string;

  // Scope and type
  scope: MandateScope;
  direction: TransferDirection;

  // Rail-specific
  rail: SettlementType;
  country: BankCountry;

  // Rail-specific identifiers
  sepa_mandate_id?: string;     // SEPA mandate reference
  bacs_ddi_reference?: string;  // UK BACS DDI reference
  ach_company_id?: string;      // ACH Originator ID

  // Status
  status: MandateStatus;
  revocable: boolean;           // Can be cancelled by account holder
  revoked_at?: string;
  revocation_reason?: string;

  // Limits
  limits: MandateLimits;

  // Schedule (for recurring)
  schedule?: MandateSchedule;

  // Authorization proof
  authorization: MandateAuthorization;

  // Dates
  effective_date: string;       // When mandate becomes active
  expires_at?: string;          // Expiration date
  created_at: string;
  updated_at: string;

  // Usage tracking
  total_transfers: number;
  total_amount_cents: number;
  last_used_at?: string;

  // Metadata
  description?: string;
  reference?: string;           // Merchant's reference
  metadata?: Record<string, unknown>;
}

// ============================================
// Mandate Creation
// ============================================

export interface CreateMandateInput {
  bank_account_id: string;
  customer_id?: string;
  scope: MandateScope;
  direction: TransferDirection;
  rail: SettlementType;
  country: BankCountry;
  limits: MandateLimits;
  schedule?: MandateSchedule;
  authorization: MandateAuthorization;
  effective_date?: string;
  expires_at?: string;
  revocable?: boolean;
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new mandate.
 */
export async function createMandate(
  supabase: any,
  tenantId: string,
  input: CreateMandateInput
): Promise<{ mandate: Mandate; error?: string }> {
  // Validate bank account exists and belongs to profile
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('id, country')
    .eq('tenant_id', tenantId)
    .eq('id', input.bank_account_id)
    .single();

  if (accountError || !account) {
    return { mandate: null as any, error: 'Bank account not found' };
  }

  // Generate rail-specific IDs
  let sepa_mandate_id: string | undefined;
  let bacs_ddi_reference: string | undefined;

  if (input.rail === 'sepa' || input.rail === 'sepa_instant') {
    // SEPA mandate ID format: max 35 chars, alphanumeric
    sepa_mandate_id = `ATLAS${Date.now().toString(36).toUpperCase()}`;
  }

  if (input.rail === 'bacs' || input.rail === 'faster_payments') {
    // BACS DDI reference: 6-18 chars
    bacs_ddi_reference = `AT${Date.now().toString(36).toUpperCase()}`;
  }

  const mandateData = {
    tenant_id: tenantId,
    bank_account_id: input.bank_account_id,
    customer_id: input.customer_id,
    scope: input.scope,
    direction: input.direction,
    rail: input.rail,
    country: input.country,
    sepa_mandate_id,
    bacs_ddi_reference,
    status: 'active' as MandateStatus,
    revocable: input.revocable ?? true,
    limits: input.limits,
    schedule: input.schedule,
    authorization_data: input.authorization,
    effective_date: input.effective_date || new Date().toISOString(),
    expires_at: input.expires_at,
    description: input.description,
    reference: input.reference,
    metadata: input.metadata,
    total_transfers: 0,
    total_amount_cents: 0,
  };

  const { data: mandate, error } = await supabase
    .from('bank_mandates')
    .insert(mandateData)
    .select()
    .single();

  if (error) {
    return { mandate: null as any, error: error.message };
  }

  return { mandate };
}

// ============================================
// Mandate Validation
// ============================================

export interface MandateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  remaining_limits?: {
    daily_remaining?: number;
    monthly_remaining?: number;
    total_remaining?: number;
    transfers_remaining?: number;
  };
}

/**
 * Validate a transfer against a mandate.
 */
export async function validateMandateForTransfer(
  supabase: any,
  mandateId: string,
  amount_cents: number,
  direction: TransferDirection
): Promise<MandateValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get mandate
  const { data: mandate, error } = await supabase
    .from('bank_mandates')
    .select('*')
    .eq('id', mandateId)
    .single();

  if (error || !mandate) {
    return { valid: false, errors: ['Mandate not found'], warnings: [] };
  }

  // Status check
  if (mandate.status !== 'active') {
    errors.push(`Mandate is ${mandate.status}`);
    return { valid: false, errors, warnings };
  }

  // Direction check
  if (mandate.direction !== direction && mandate.direction !== 'both') {
    errors.push(`Mandate does not authorize ${direction} transfers`);
  }

  // Expiration check
  if (mandate.expires_at && new Date(mandate.expires_at) < new Date()) {
    errors.push('Mandate has expired');
  }

  // Effective date check
  if (mandate.effective_date && new Date(mandate.effective_date) > new Date()) {
    errors.push('Mandate is not yet effective');
  }

  const limits = mandate.limits as MandateLimits;

  // Per-transfer amount checks
  if (limits.max_amount_cents && amount_cents > limits.max_amount_cents) {
    errors.push(`Amount exceeds mandate limit of ${limits.max_amount_cents / 100}`);
  }

  if (limits.min_amount_cents && amount_cents < limits.min_amount_cents) {
    errors.push(`Amount below mandate minimum of ${limits.min_amount_cents / 100}`);
  }

  // Get usage for aggregate checks
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);

  const { data: todayUsage } = await supabase
    .from('bank_transfers')
    .select('amount')
    .eq('mandate_id', mandateId)
    .gte('created_at', today)
    .not('status', 'in', '("failed","returned","cancelled")');

  const { data: monthUsage } = await supabase
    .from('bank_transfers')
    .select('amount')
    .eq('mandate_id', mandateId)
    .gte('created_at', monthStart.toISOString())
    .not('status', 'in', '("failed","returned","cancelled")');

  const todayTotal = (todayUsage || []).reduce((sum: number, t: any) => sum + t.amount, 0);
  const monthTotal = (monthUsage || []).reduce((sum: number, t: any) => sum + t.amount, 0);
  const todayCount = todayUsage?.length || 0;
  const monthCount = monthUsage?.length || 0;

  // Daily limit check
  if (limits.daily_limit_cents && (todayTotal + amount_cents) > limits.daily_limit_cents) {
    errors.push('Daily mandate limit would be exceeded');
  }

  // Monthly limit check
  if (limits.monthly_limit_cents && (monthTotal + amount_cents) > limits.monthly_limit_cents) {
    errors.push('Monthly mandate limit would be exceeded');
  }

  // Transfer count checks
  if (limits.max_transfers_per_day && todayCount >= limits.max_transfers_per_day) {
    errors.push('Daily transfer count limit reached');
  }

  if (limits.max_transfers_per_month && monthCount >= limits.max_transfers_per_month) {
    errors.push('Monthly transfer count limit reached');
  }

  // Lifetime limits
  if (limits.total_amount_cents && (mandate.total_amount_cents + amount_cents) > limits.total_amount_cents) {
    errors.push('Total mandate value limit would be exceeded');
  }

  if (limits.total_transfer_count && mandate.total_transfers >= limits.total_transfer_count) {
    errors.push('Total transfer count limit reached');
  }

  // Scope-specific checks
  if (mandate.scope === 'single' && mandate.total_transfers > 0) {
    errors.push('Single-use mandate has already been used');
  }

  // Calculate remaining limits
  const remaining_limits = {
    daily_remaining: limits.daily_limit_cents
      ? Math.max(0, limits.daily_limit_cents - todayTotal)
      : undefined,
    monthly_remaining: limits.monthly_limit_cents
      ? Math.max(0, limits.monthly_limit_cents - monthTotal)
      : undefined,
    total_remaining: limits.total_amount_cents
      ? Math.max(0, limits.total_amount_cents - mandate.total_amount_cents)
      : undefined,
    transfers_remaining: limits.total_transfer_count
      ? Math.max(0, limits.total_transfer_count - mandate.total_transfers)
      : undefined,
  };

  // Warnings for approaching limits
  if (remaining_limits.daily_remaining !== undefined && remaining_limits.daily_remaining < amount_cents * 2) {
    warnings.push('Approaching daily limit');
  }
  if (remaining_limits.monthly_remaining !== undefined && remaining_limits.monthly_remaining < amount_cents * 5) {
    warnings.push('Approaching monthly limit');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    remaining_limits,
  };
}

// ============================================
// Mandate Actions
// ============================================

/**
 * Record mandate usage after a successful transfer.
 */
export async function recordMandateUsage(
  supabase: any,
  mandateId: string,
  amount_cents: number
): Promise<void> {
  await supabase.rpc('increment_mandate_usage', {
    p_mandate_id: mandateId,
    p_amount: amount_cents,
  });

  // Fallback if RPC doesn't exist
  const { data: mandate } = await supabase
    .from('bank_mandates')
    .select('total_transfers, total_amount_cents')
    .eq('id', mandateId)
    .single();

  if (mandate) {
    await supabase
      .from('bank_mandates')
      .update({
        total_transfers: (mandate.total_transfers || 0) + 1,
        total_amount_cents: (mandate.total_amount_cents || 0) + amount_cents,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', mandateId);
  }
}

/**
 * Revoke a mandate.
 */
export async function revokeMandate(
  supabase: any,
  mandateId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: mandate, error: fetchError } = await supabase
    .from('bank_mandates')
    .select('status, revocable')
    .eq('id', mandateId)
    .single();

  if (fetchError || !mandate) {
    return { success: false, error: 'Mandate not found' };
  }

  if (!mandate.revocable) {
    return { success: false, error: 'Mandate is not revocable' };
  }

  if (mandate.status === 'revoked') {
    return { success: false, error: 'Mandate is already revoked' };
  }

  const { error } = await supabase
    .from('bank_mandates')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('id', mandateId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Suspend a mandate temporarily.
 */
export async function suspendMandate(
  supabase: any,
  mandateId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('bank_mandates')
    .update({
      status: 'suspended',
      metadata: { suspension_reason: reason, suspended_at: new Date().toISOString() },
    })
    .eq('id', mandateId)
    .eq('status', 'active');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reactivate a suspended mandate.
 */
export async function reactivateMandate(
  supabase: any,
  mandateId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('bank_mandates')
    .update({
      status: 'active',
    })
    .eq('id', mandateId)
    .eq('status', 'suspended');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// SEPA-specific Functions
// ============================================

/**
 * Generate SEPA mandate XML for download/submission.
 */
export function generateSepaMandateXml(mandate: Mandate): string {
  if (!mandate.sepa_mandate_id) {
    throw new Error('Not a SEPA mandate');
  }

  // Simplified SEPA mandate XML (would be full pain.008 in production)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Mndt>
  <MndtId>${mandate.sepa_mandate_id}</MndtId>
  <MndtReqId>${mandate.id}</MndtReqId>
  <Tp>
    <SvcLvl><Cd>SEPA</Cd></SvcLvl>
    <LclInstrm><Cd>${mandate.scope === 'single' ? 'OOFF' : 'RCUR'}</Cd></LclInstrm>
  </Tp>
  <Ocrncs>
    <SeqTp>${mandate.scope === 'single' ? 'OOFF' : 'RCUR'}</SeqTp>
  </Ocrncs>
  <DtOfSgntr>${mandate.authorization.signed_at.split('T')[0]}</DtOfSgntr>
</Mndt>`;
}
