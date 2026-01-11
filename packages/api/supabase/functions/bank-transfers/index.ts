/**
 * Bank Transfers API
 *
 * Initiate and manage ACH/A2A bank transfers.
 *
 * Routes:
 *   POST   /bank-transfers              - Initiate a transfer
 *   GET    /bank-transfers              - List transfers
 *   GET    /bank-transfers/:id          - Get a transfer
 *   POST   /bank-transfers/:id/cancel   - Cancel a pending transfer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash, createDecipheriv } from 'node:crypto';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

// ============================================
// Types
// ============================================

interface CreateTransferRequest {
  bank_account_id: string;
  amount: number;
  currency?: string;
  direction: 'debit' | 'credit';
  description?: string;
  statement_descriptor?: string;
  settlement_provider?: 'nacha' | 'stripe_ach' | 'dwolla';
  idempotency_key?: string;
  metadata?: Record<string, string>;
}

interface TransferResponse {
  id: string;
  object: 'bank_transfer';
  bank_account_id: string;
  amount: number;
  currency: string;
  direction: string;
  status: string;
  description: string | null;
  statement_descriptor: string | null;
  settlement_provider: string;
  failure_reason: string | null;
  failure_code: string | null;
  initiated_at: number | null;
  settled_at: number | null;
  returned_at: number | null;
  return_code: string | null;
  return_reason: string | null;
  metadata: Record<string, string>;
  created: number;
}

// ============================================
// Risk Assessment (simplified)
// ============================================

interface RiskConfig {
  max_daily_transfers: number;
  max_daily_amount: number;
  max_single_transfer: number;
  min_single_transfer: number;
  block_threshold: number;
}

const DEFAULT_RISK_CONFIG: RiskConfig = {
  max_daily_transfers: 10,
  max_daily_amount: 100000_00,  // $100,000
  max_single_transfer: 50000_00, // $50,000
  min_single_transfer: 100,      // $1.00
  block_threshold: 80,
};

async function assessTransferRisk(
  supabase: any,
  bankAccountId: string,
  amount: number,
  direction: string,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): Promise<{ approved: boolean; score: number; flags: string[]; error?: string }> {
  const flags: string[] = [];
  let score = 0;

  // 1. Check account verification
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('verification_status, is_active')
    .eq('id', bankAccountId)
    .single();

  if (!account?.is_active) {
    return { approved: false, score: 100, flags: ['account_inactive'], error: 'Bank account is inactive' };
  }

  if (account?.verification_status !== 'verified') {
    flags.push('account_not_verified');
    score += 50;
  }

  // 2. Check amount limits
  if (amount > config.max_single_transfer) {
    flags.push('exceeds_single_limit');
    score += 40;
  }

  if (amount < config.min_single_transfer) {
    return { approved: false, score: 100, flags: ['below_minimum'], error: 'Amount below minimum' };
  }

  // 3. Check velocity
  const today = new Date().toISOString().split('T')[0];
  const { data: dailyTransfers, count: dailyCount } = await supabase
    .from('bank_transfers')
    .select('amount', { count: 'exact' })
    .eq('bank_account_id', bankAccountId)
    .eq('direction', direction)
    .gte('created_at', today)
    .not('status', 'in', '("failed","returned")');

  const dailyTotal = (dailyTransfers || []).reduce((sum: number, t: any) => sum + t.amount, 0);

  if ((dailyCount || 0) >= config.max_daily_transfers) {
    flags.push('daily_count_exceeded');
    score += 30;
  }

  if (dailyTotal + amount > config.max_daily_amount) {
    flags.push('daily_amount_exceeded');
    score += 40;
  }

  // 4. Check for first transfer
  const { count: totalCount } = await supabase
    .from('bank_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'settled');

  if ((totalCount || 0) === 0) {
    flags.push('first_transfer');
    score += 10;
  }

  // 5. Check return history
  const { count: returnCount } = await supabase
    .from('bank_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccountId)
    .eq('status', 'returned');

  if ((returnCount || 0) > 0) {
    flags.push('has_returns');
    score += (returnCount || 0) * 15;
  }

  return {
    approved: score < config.block_threshold,
    score: Math.min(score, 100),
    flags,
  };
}

// ============================================
// Vault Functions
// ============================================

function getEncryptionKey(): Uint8Array {
  const key = Deno.env.get('BANK_VAULT_KEY') || Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!key) {
    throw new Error('BANK_VAULT_KEY environment variable is required');
  }
  return createHash('sha256').update(key).digest();
}

function decryptBankData(vaultToken: string): {
  account_number: string;
  routing_number: string;
} {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encrypted] = vaultToken.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ============================================
// Formatting
// ============================================

function formatTransfer(transfer: any): TransferResponse {
  return {
    id: transfer.id,
    object: 'bank_transfer',
    bank_account_id: transfer.bank_account_id,
    amount: transfer.amount,
    currency: transfer.currency,
    direction: transfer.direction,
    status: transfer.status,
    description: transfer.description,
    statement_descriptor: transfer.statement_descriptor,
    settlement_provider: transfer.settlement_provider,
    failure_reason: transfer.failure_reason,
    failure_code: transfer.failure_code,
    initiated_at: transfer.initiated_at ? Math.floor(new Date(transfer.initiated_at).getTime() / 1000) : null,
    settled_at: transfer.settled_at ? Math.floor(new Date(transfer.settled_at).getTime() / 1000) : null,
    returned_at: transfer.returned_at ? Math.floor(new Date(transfer.returned_at).getTime() / 1000) : null,
    return_code: transfer.return_code,
    return_reason: transfer.return_reason,
    metadata: transfer.metadata || {},
    created: Math.floor(new Date(transfer.created_at).getTime() / 1000),
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

    const transferId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Route: POST /bank-transfers/:id/cancel - Cancel transfer
    if (req.method === 'POST' && transferId && action === 'cancel') {
      const { data: transfer, error: fetchError } = await supabase
        .from('bank_transfers')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', transferId)
        .single();

      if (fetchError || !transfer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Transfer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (transfer.status !== 'pending') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'cannot_cancel',
              message: `Cannot cancel transfer in ${transfer.status} status`,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated, error } = await supabase
        .from('bank_transfers')
        .update({ status: 'cancelled' })
        .eq('id', transferId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'cancel_failed', message: 'Failed to cancel transfer' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatTransfer(updated)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /bank-transfers - Create transfer
    if (req.method === 'POST' && !transferId) {
      const body: CreateTransferRequest = await req.json();

      // Validate required fields
      if (!body.bank_account_id || !body.amount || !body.direction) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'bank_account_id, amount, and direction are required',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['debit', 'credit'].includes(body.direction)) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'direction must be debit or credit' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.amount <= 0) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'amount must be positive' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check idempotency
      if (body.idempotency_key) {
        const { data: existing } = await supabase
          .from('bank_transfers')
          .select('*')
          .eq('tenant_id', auth.tenantId)
          .eq('idempotency_key', body.idempotency_key)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify(formatTransfer(existing)),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Verify bank account exists and belongs to tenant
      const { data: bankAccount, error: accountError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', body.bank_account_id)
        .single();

      if (accountError || !bankAccount) {
        return new Response(
          JSON.stringify({ error: { code: 'account_not_found', message: 'Bank account not found' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Run risk assessment
      const riskResult = await assessTransferRisk(
        supabase,
        body.bank_account_id,
        body.amount,
        body.direction
      );

      if (!riskResult.approved) {
        // Record risk event
        await supabase.from('bank_risk_events').insert({
          tenant_id: auth.tenantId,
          bank_account_id: body.bank_account_id,
          event_type: 'transfer_blocked',
          severity: 'high',
          description: riskResult.error || 'Transfer blocked by risk assessment',
          details: { score: riskResult.score, flags: riskResult.flags },
        });

        return new Response(
          JSON.stringify({
            error: {
              code: 'risk_blocked',
              message: riskResult.error || 'Transfer blocked by risk assessment',
              risk_score: riskResult.score,
              flags: riskResult.flags,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the transfer
      const { data: transfer, error } = await supabase
        .from('bank_transfers')
        .insert({
          tenant_id: auth.tenantId,
          bank_account_id: body.bank_account_id,
          mandate_id: null, // Would be set if mandate-based
          amount: body.amount,
          currency: body.currency || bankAccount.currency || 'USD',
          direction: body.direction,
          status: 'pending',
          settlement_provider: body.settlement_provider || 'stripe_ach',
          description: body.description,
          statement_descriptor: body.statement_descriptor,
          idempotency_key: body.idempotency_key,
          risk_score: riskResult.score,
          risk_flags: riskResult.flags,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Bank Transfers] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create transfer' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // In production, this would trigger async processing via queue
      // For now, we mark as initiated
      await supabase
        .from('bank_transfers')
        .update({ initiated_at: new Date().toISOString() })
        .eq('id', transfer.id);

      return new Response(
        JSON.stringify(formatTransfer({ ...transfer, initiated_at: new Date().toISOString() })),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-transfers - List transfers
    if (req.method === 'GET' && !transferId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const bankAccountId = url.searchParams.get('bank_account_id');
      const status = url.searchParams.get('status');
      const direction = url.searchParams.get('direction');

      let query = supabase
        .from('bank_transfers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (bankAccountId) {
        query = query.eq('bank_account_id', bankAccountId);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (direction) {
        query = query.eq('direction', direction);
      }

      const { data: transfers, error, count } = await query;

      if (error) {
        console.error('[Bank Transfers] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list transfers' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (transfers || []).map(formatTransfer),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-transfers/:id - Get transfer
    if (req.method === 'GET' && transferId && !action) {
      const { data: transfer, error } = await supabase
        .from('bank_transfers')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', transferId)
        .single();

      if (error || !transfer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Transfer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatTransfer(transfer)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Bank Transfers] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
