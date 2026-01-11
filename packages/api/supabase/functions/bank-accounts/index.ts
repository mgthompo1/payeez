/**
 * Bank Accounts API
 *
 * CRUD operations for bank account management.
 * Bank accounts are used for A2A/ACH transfers.
 *
 * Routes:
 *   POST   /bank-accounts              - Add a bank account
 *   GET    /bank-accounts              - List bank accounts
 *   GET    /bank-accounts/:id          - Get a bank account
 *   PATCH  /bank-accounts/:id          - Update a bank account
 *   DELETE /bank-accounts/:id          - Delete a bank account
 *   POST   /bank-accounts/:id/verify   - Verify micro-deposits
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';
import { initiateVerification, verifyMicroDeposits, checkVerificationStatus } from '../_shared/ach/index.ts';

// ============================================
// Types
// ============================================

interface CreateBankAccountRequest {
  customer_id: string;
  account_number: string;
  routing_number: string;
  holder_name: string;
  account_type?: 'checking' | 'savings';
  country?: string;
  currency?: string;
  metadata?: Record<string, string>;
}

interface UpdateBankAccountRequest {
  nickname?: string;
  is_default?: boolean;
  metadata?: Record<string, string>;
}

interface VerifyMicrodepositRequest {
  amounts: [number, number];
}

interface BankAccountResponse {
  id: string;
  object: 'bank_account';
  customer_id: string;
  holder_name: string;
  account_type: string;
  last4: string;
  routing_last4: string;
  bank_name: string | null;
  country: string;
  currency: string;
  is_default: boolean;
  verification_status: string;
  verification_method: string | null;
  nickname: string | null;
  metadata: Record<string, string>;
  created: number;
}

// ============================================
// Vault Functions (simplified for edge function)
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Uint8Array {
  const key = Deno.env.get('BANK_VAULT_KEY') || Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!key) {
    throw new Error('BANK_VAULT_KEY environment variable is required');
  }
  return createHash('sha256').update(key).digest();
}

function encryptBankData(data: {
  account_number: string;
  routing_number: string;
  holder_name: string;
  account_type: string;
}): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function decryptBankData(vaultToken: string): {
  account_number: string;
  routing_number: string;
  holder_name: string;
  account_type: string;
} {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encrypted] = vaultToken.split(':');

  if (!ivB64 || !authTagB64 || !encrypted) {
    throw new Error('Invalid vault token format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

function hashValue(value: string, prefix: string): string {
  const salt = Deno.env.get('BANK_HASH_SALT');
  if (!salt) {
    throw new Error('BANK_HASH_SALT environment variable is required for production security');
  }
  return createHash('sha256')
    .update(`${salt}:${prefix}:${value}`)
    .digest('hex');
}

// ============================================
// Validation
// ============================================

function validateABARoutingNumber(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) {
    return false;
  }

  const digits = routingNumber.split('').map(Number);
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);

  return checksum % 10 === 0;
}

// ============================================
// Formatting
// ============================================

function formatBankAccount(account: any): BankAccountResponse {
  return {
    id: account.id,
    object: 'bank_account',
    customer_id: account.customer_id,
    holder_name: account.holder_name,
    account_type: account.account_type,
    last4: account.last4,
    routing_last4: account.routing_last4,
    bank_name: account.bank_name,
    country: account.country,
    currency: account.currency,
    is_default: account.is_default || false,
    verification_status: account.verification_status,
    verification_method: account.verification_method,
    nickname: account.nickname,
    metadata: account.metadata || {},
    created: Math.floor(new Date(account.created_at).getTime() / 1000),
  };
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const auth = await authenticateApiKey(
      req.headers.get('authorization'),
      supabaseUrl,
      supabaseServiceKey
    );

    if (!auth) {
      return new Response(
        JSON.stringify({ error: { code: 'unauthorized', message: 'Invalid API key' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Path: /bank-accounts, /bank-accounts/:id, or /bank-accounts/:id/verify
    const accountId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Route: POST /bank-accounts/:id/verify - Verify micro-deposits
    if (req.method === 'POST' && accountId && action === 'verify') {
      const body: VerifyMicrodepositRequest = await req.json();

      if (!body.amounts || body.amounts.length !== 2) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'amounts must be an array of two numbers' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the bank account
      const { data: account, error: accountError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', accountId)
        .single();

      if (accountError || !account) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Bank account not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (account.verification_status === 'verified') {
        return new Response(
          JSON.stringify({ error: { code: 'already_verified', message: 'Account is already verified' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Provider-managed verification: check provider status first
      // This supports cases where the provider sends micro-deposits and we don't know the amounts
      if (account.verification_evidence_ref && !body.amounts) {
        // Check verification status via provider
        const statusResult = await checkVerificationStatus(
          account.verification_evidence_ref,
          auth.tenantId,
          supabase
        );

        if (statusResult.status === 'verified') {
          // Provider verified the account - update our records
          await supabase
            .from('bank_accounts')
            .update({
              verification_status: 'verified',
              verification_strength: 'basic',
              verified_at: statusResult.verifiedAt || new Date().toISOString(),
              provider_payment_method_id: statusResult.paymentMethodId,
            })
            .eq('id', accountId);

          return new Response(
            JSON.stringify({ verified: true, payment_method_id: statusResult.paymentMethodId }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (statusResult.status === 'failed') {
          await supabase
            .from('bank_accounts')
            .update({ verification_status: 'failed' })
            .eq('id', accountId);

          return new Response(
            JSON.stringify({ verified: false, error: { code: 'verification_failed', message: statusResult.error || 'Provider verification failed' } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Still pending
          return new Response(
            JSON.stringify({ verified: false, status: 'pending', message: 'Verification still pending with provider' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // For amount-based verification, require amounts
      if (!body.amounts || !Array.isArray(body.amounts) || body.amounts.length !== 2) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_amounts', message: 'Two micro-deposit amounts required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For local verification, require local amounts to be stored
      if (!account.verification_evidence_ref && (!account.microdeposit_amount_1 || !account.microdeposit_amount_2)) {
        return new Response(
          JSON.stringify({ error: { code: 'not_initiated', message: 'Micro-deposits not initiated' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiry
      if (account.microdeposit_expires_at && new Date(account.microdeposit_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: { code: 'expired', message: 'Micro-deposits have expired' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const attempts = (account.verification_attempts || 0) + 1;
      const maxAttempts = 3;
      let isCorrect = false;
      let paymentMethodId: string | undefined;

      // If we have a provider reference (e.g., Stripe SetupIntent), verify through the provider
      if (account.verification_evidence_ref) {
        const verifyResult = await verifyMicroDeposits(
          account.verification_evidence_ref,
          body.amounts as [number, number],
          auth.tenantId,
          supabase
        );

        if (verifyResult.success) {
          isCorrect = true;
          paymentMethodId = verifyResult.paymentMethodId;
        } else if (verifyResult.error) {
          // Provider-specific verification failure
          console.log(`[Bank Accounts] Provider verification failed: ${verifyResult.error}`);
          // Don't count this as an attempt if it's a provider error
          if (verifyResult.error.includes('network') || verifyResult.error.includes('timeout')) {
            return new Response(
              JSON.stringify({ error: { code: 'provider_error', message: 'Verification service temporarily unavailable' } }),
              { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } else {
        // Fall back to local verification for legacy accounts
        const correctAmounts = [account.microdeposit_amount_1, account.microdeposit_amount_2].sort((a: number, b: number) => a - b);
        const userAmounts = [...body.amounts].sort((a, b) => a - b);
        isCorrect = correctAmounts[0] === userAmounts[0] && correctAmounts[1] === userAmounts[1];
      }

      if (isCorrect) {
        await supabase
          .from('bank_accounts')
          .update({
            verification_status: 'verified',
            verification_strength: 'basic', // Micro-deposits are basic verification
            verified_at: new Date().toISOString(),
            verification_attempts: attempts,
            provider_payment_method_id: paymentMethodId,
          })
          .eq('id', accountId);

        return new Response(
          JSON.stringify({ verified: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        if (attempts >= maxAttempts) {
          await supabase
            .from('bank_accounts')
            .update({
              verification_status: 'failed',
              verification_attempts: attempts,
            })
            .eq('id', accountId);

          return new Response(
            JSON.stringify({
              verified: false,
              error: { code: 'max_attempts', message: 'Maximum verification attempts exceeded' },
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('bank_accounts')
          .update({ verification_attempts: attempts })
          .eq('id', accountId);

        return new Response(
          JSON.stringify({
            verified: false,
            attempts_remaining: maxAttempts - attempts,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route: POST /bank-accounts/:id/initiate-microdeposits - Initiate micro-deposit verification
    if (req.method === 'POST' && accountId && action === 'initiate-microdeposits') {
      // Get the bank account
      const { data: account, error: accountError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', accountId)
        .single();

      if (accountError || !account) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Bank account not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (account.verification_status === 'verified') {
        return new Response(
          JSON.stringify({ error: { code: 'already_verified', message: 'Account is already verified' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (account.verification_status === 'pending' && account.microdeposit_amount_1) {
        // Already initiated, return current status
        return new Response(
          JSON.stringify({
            status: 'pending',
            message: 'Micro-deposits already initiated',
            expires_at: account.microdeposit_expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the decrypted bank account data for verification
      let bankData;
      try {
        bankData = decryptBankData(account.vault_token);
      } catch (decryptError) {
        console.error('[Bank Accounts] Failed to decrypt bank data:', decryptError);
        return new Response(
          JSON.stringify({ error: { code: 'decrypt_failed', message: 'Failed to access bank account data' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call the ACH adapter to initiate verification
      const { response: verificationResult, provider } = await initiateVerification(
        {
          accountNumber: bankData.account_number,
          routingNumber: bankData.routing_number,
          accountType: (bankData.account_type as 'checking' | 'savings') || 'checking',
          accountHolderName: bankData.holder_name,
          accountHolderType: 'individual', // Could be determined from customer type
        },
        auth.tenantId,
        supabase,
        {
          preferredMethod: 'micro_deposits',
        }
      );

      if (!verificationResult.success) {
        console.error('[Bank Accounts] ACH verification initiation failed:', verificationResult.error);
        return new Response(
          JSON.stringify({
            error: {
              code: 'initiate_failed',
              message: verificationResult.error || 'Failed to initiate micro-deposits via ACH provider',
            },
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set expiry based on provider response or default to 10 days
      const expiresAt = verificationResult.expiresAt
        ? new Date(verificationResult.expiresAt)
        : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      // Update account with verification info
      const { error: updateError } = await supabase
        .from('bank_accounts')
        .update({
          verification_method: verificationResult.method,
          verification_status: 'pending',
          verification_strength: verificationResult.strength,
          verification_evidence_ref: verificationResult.providerRef,
          // For micro-deposits, amounts come from provider (Stripe sends them automatically)
          // We store the provider ref so we can verify later
          microdeposit_amount_1: verificationResult.amounts?.[0] || null,
          microdeposit_amount_2: verificationResult.amounts?.[1] || null,
          microdeposit_sent_at: new Date().toISOString(),
          microdeposit_expires_at: expiresAt.toISOString(),
          verification_attempts: 0,
        })
        .eq('id', accountId);

      if (updateError) {
        console.error('[Bank Accounts] Update after initiation failed:', updateError);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update verification status' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Bank Accounts] Verification initiated for ${accountId} via ${provider} (${verificationResult.method})`);

      return new Response(
        JSON.stringify({
          status: 'pending',
          method: verificationResult.method,
          strength: verificationResult.strength,
          message: verificationResult.method === 'financial_connections'
            ? 'Please complete bank verification via the provided link.'
            : 'Micro-deposits initiated. Two small deposits will appear in 1-3 business days.',
          expires_at: expiresAt.toISOString(),
          // For Financial Connections, include the session URL
          session_url: verificationResult.sessionUrl,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /bank-accounts - Create bank account
    if (req.method === 'POST' && !accountId) {
      const body: CreateBankAccountRequest = await req.json();

      // Validate required fields
      if (!body.account_number || !body.routing_number || !body.holder_name) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'account_number, routing_number, and holder_name are required',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate customer exists
      if (body.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', auth.tenantId)
          .eq('id', body.customer_id)
          .single();

        if (!customer) {
          return new Response(
            JSON.stringify({ error: { code: 'customer_not_found', message: 'Customer not found' } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate routing number
      if (!validateABARoutingNumber(body.routing_number)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_routing', message: 'Invalid routing number' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for duplicates
      const accountHash = hashValue(`${body.routing_number}:${body.account_number}`, 'account');
      const { data: existing } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('account_hash', accountHash)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'account_exists',
              message: 'This bank account is already on file',
              existing_account_id: existing.id,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Encrypt and vault the account data
      const vaultToken = encryptBankData({
        account_number: body.account_number,
        routing_number: body.routing_number,
        holder_name: body.holder_name,
        account_type: body.account_type || 'checking',
      });

      // Create bank account
      const { data: account, error } = await supabase
        .from('bank_accounts')
        .insert({
          tenant_id: auth.tenantId,
          customer_id: body.customer_id || null,
          vault_token: vaultToken,
          last4: body.account_number.slice(-4),
          routing_last4: body.routing_number.slice(-4),
          routing_hash: hashValue(body.routing_number, 'routing'),
          account_hash: accountHash,
          holder_name: body.holder_name,
          account_type: body.account_type || 'checking',
          country: body.country || 'US',
          currency: body.currency || 'USD',
          verification_status: 'unverified',
          is_active: true,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Bank Accounts] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create bank account' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatBankAccount(account)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-accounts - List bank accounts
    if (req.method === 'GET' && !accountId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const customerId = url.searchParams.get('customer_id');
      const status = url.searchParams.get('verification_status');

      let query = supabase
        .from('bank_accounts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      if (status) {
        query = query.eq('verification_status', status);
      }

      const { data: accounts, error, count } = await query;

      if (error) {
        console.error('[Bank Accounts] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list bank accounts' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (accounts || []).map(formatBankAccount),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-accounts/:id - Get bank account
    if (req.method === 'GET' && accountId && !action) {
      const { data: account, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', accountId)
        .single();

      if (error || !account) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Bank account not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatBankAccount(account)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /bank-accounts/:id - Update bank account
    if (req.method === 'PATCH' && accountId && !action) {
      const body: UpdateBankAccountRequest = await req.json();

      const { data: existing } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', accountId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Bank account not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body.nickname !== undefined) updateData.nickname = body.nickname;
      if (body.is_default !== undefined) updateData.is_default = body.is_default;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      // If setting as default, unset other defaults
      if (body.is_default === true) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('tenant_id', auth.tenantId)
          .neq('id', accountId);
      }

      const { data: account, error } = await supabase
        .from('bank_accounts')
        .update(updateData)
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        console.error('[Bank Accounts] Update error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update bank account' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatBankAccount(account)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /bank-accounts/:id - Delete bank account
    if (req.method === 'DELETE' && accountId && !action) {
      const { data: existing } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', accountId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Bank account not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for pending transfers
      const { data: pendingTransfers } = await supabase
        .from('bank_transfers')
        .select('id')
        .eq('bank_account_id', accountId)
        .in('status', ['pending', 'processing'])
        .limit(1);

      if (pendingTransfers && pendingTransfers.length > 0) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'has_pending_transfers',
              message: 'Cannot delete bank account with pending transfers',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Soft delete (mark inactive)
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) {
        console.error('[Bank Accounts] Delete error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'delete_failed', message: 'Failed to delete bank account' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ id: accountId, object: 'bank_account', deleted: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Bank Accounts] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
