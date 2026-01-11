/**
 * Bank Mandates API
 *
 * CRUD operations for ACH debit mandates (authorization agreements).
 * Mandates are required for ACH debits to comply with NACHA rules.
 *
 * Routes:
 *   POST   /bank-mandates              - Create a mandate
 *   GET    /bank-mandates              - List mandates
 *   GET    /bank-mandates/:id          - Get a mandate
 *   POST   /bank-mandates/:id/revoke   - Revoke a mandate
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

// ============================================
// Types
// ============================================

interface CreateMandateRequest {
  bank_account_id: string;
  customer_id?: string;
  authorization_type?: 'debit' | 'credit' | 'both';
  frequency?: 'once' | 'recurring';
  amount_limit?: number;
  daily_limit?: number;
  monthly_limit?: number;
  authorization_text: string;
  ip_address: string;
  user_agent?: string;
  subscription_id?: string;
  expires_at?: string;
  metadata?: Record<string, string>;
}

interface MandateResponse {
  id: string;
  object: 'bank_mandate';
  bank_account_id: string;
  customer_id: string | null;
  authorization_type: string;
  frequency: string;
  amount_limit: number | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  authorization_text: string;
  text_version: string;
  accepted_at: number;
  ip_address: string;
  status: string;
  revoked_at: number | null;
  revoked_reason: string | null;
  expires_at: number | null;
  subscription_id: string | null;
  metadata: Record<string, string>;
  created: number;
}

// ============================================
// Formatting
// ============================================

function formatMandate(mandate: any): MandateResponse {
  return {
    id: mandate.id,
    object: 'bank_mandate',
    bank_account_id: mandate.bank_account_id,
    customer_id: mandate.customer_id,
    authorization_type: mandate.authorization_type,
    frequency: mandate.frequency,
    amount_limit: mandate.amount_limit,
    daily_limit: mandate.daily_limit,
    monthly_limit: mandate.monthly_limit,
    authorization_text: mandate.authorization_text,
    text_version: mandate.text_version,
    accepted_at: Math.floor(new Date(mandate.accepted_at).getTime() / 1000),
    ip_address: mandate.ip_address,
    status: mandate.status,
    revoked_at: mandate.revoked_at ? Math.floor(new Date(mandate.revoked_at).getTime() / 1000) : null,
    revoked_reason: mandate.revoked_reason,
    expires_at: mandate.expires_at ? Math.floor(new Date(mandate.expires_at).getTime() / 1000) : null,
    subscription_id: mandate.subscription_id,
    metadata: mandate.metadata || {},
    created: Math.floor(new Date(mandate.created_at).getTime() / 1000),
  };
}

// Default authorization text templates
const AUTHORIZATION_TEMPLATES = {
  debit_once: `By providing your bank account information and clicking "Authorize", you authorize [COMPANY_NAME] to debit your bank account for a one-time payment of [AMOUNT]. You understand that this authorization will remain in effect until the payment is processed or you cancel this authorization.`,

  debit_recurring: `By providing your bank account information and clicking "Authorize", you authorize [COMPANY_NAME] to debit your bank account on a recurring basis for the amounts specified in your subscription. These debits will continue until you cancel your subscription or revoke this authorization. You can cancel at any time by contacting us.`,

  credit: `By providing your bank account information, you authorize [COMPANY_NAME] to credit your bank account for payments owed to you.`,
};

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

    const mandateId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Route: POST /bank-mandates/:id/revoke - Revoke mandate
    if (req.method === 'POST' && mandateId && action === 'revoke') {
      const body = await req.json().catch(() => ({}));

      const { data: mandate, error: fetchError } = await supabase
        .from('bank_mandates')
        .select('*')
        .eq('id', mandateId)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (fetchError || !mandate) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Mandate not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (mandate.status !== 'active') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'already_revoked',
              message: `Mandate is already ${mandate.status}`,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from('bank_mandates')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: body.reason || 'Revoked by merchant',
        })
        .eq('id', mandateId)
        .select()
        .single();

      if (updateError) {
        console.error('[Bank Mandates] Revoke error:', updateError);
        return new Response(
          JSON.stringify({ error: { code: 'revoke_failed', message: 'Failed to revoke mandate' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatMandate(updated)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /bank-mandates - Create mandate
    if (req.method === 'POST' && !mandateId) {
      const body: CreateMandateRequest = await req.json();

      // Validate required fields
      if (!body.bank_account_id) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'bank_account_id is required',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.authorization_text) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'authorization_text is required',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.ip_address) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'ip_address is required for legal compliance',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify bank account exists and belongs to tenant
      const { data: bankAccount, error: accountError } = await supabase
        .from('bank_accounts')
        .select('id, customer_id, verification_status')
        .eq('id', body.bank_account_id)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (accountError || !bankAccount) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'bank_account_not_found',
              message: 'Bank account not found',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For debit mandates, account should be verified
      if (body.authorization_type !== 'credit' && bankAccount.verification_status !== 'verified') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'account_not_verified',
              message: 'Bank account must be verified before creating a debit mandate',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing active mandate on this account
      const { data: existingMandate } = await supabase
        .from('bank_mandates')
        .select('id')
        .eq('bank_account_id', body.bank_account_id)
        .eq('tenant_id', auth.tenantId)
        .eq('status', 'active')
        .single();

      if (existingMandate && body.frequency === 'recurring') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'mandate_exists',
              message: 'An active mandate already exists for this bank account',
              existing_mandate_id: existingMandate.id,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create mandate
      const { data: mandate, error: createError } = await supabase
        .from('bank_mandates')
        .insert({
          tenant_id: auth.tenantId,
          bank_account_id: body.bank_account_id,
          customer_id: body.customer_id || bankAccount.customer_id,
          authorization_type: body.authorization_type || 'debit',
          frequency: body.frequency || 'recurring',
          amount_limit: body.amount_limit,
          daily_limit: body.daily_limit,
          monthly_limit: body.monthly_limit,
          authorization_text: body.authorization_text,
          text_version: 'v1.0.0',
          accepted_at: new Date().toISOString(),
          ip_address: body.ip_address,
          user_agent: body.user_agent,
          subscription_id: body.subscription_id,
          status: 'active',
          expires_at: body.expires_at,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (createError) {
        console.error('[Bank Mandates] Create error:', createError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create mandate' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatMandate(mandate)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-mandates - List mandates
    if (req.method === 'GET' && !mandateId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const bankAccountId = url.searchParams.get('bank_account_id');
      const customerId = url.searchParams.get('customer_id');
      const status = url.searchParams.get('status');

      let query = supabase
        .from('bank_mandates')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (bankAccountId) {
        query = query.eq('bank_account_id', bankAccountId);
      }
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data: mandates, error, count } = await query;

      if (error) {
        console.error('[Bank Mandates] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list mandates' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (mandates || []).map(formatMandate),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /bank-mandates/:id - Get mandate
    if (req.method === 'GET' && mandateId && !action) {
      const { data: mandate, error } = await supabase
        .from('bank_mandates')
        .select('*')
        .eq('id', mandateId)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (error || !mandate) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Mandate not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatMandate(mandate)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Bank Mandates] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
