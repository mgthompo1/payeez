/**
 * Portal Sessions API
 *
 * Create secure customer portal sessions for managing subscriptions and payment methods.
 *
 * Routes:
 *   POST /portal-sessions     - Create a portal session
 *   GET  /portal-sessions/:id - Get a portal session (for verification)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreatePortalSessionRequest {
  customer: string;
  return_url: string;
  configuration?: {
    features?: {
      subscription_cancel?: { enabled: boolean };
      subscription_pause?: { enabled: boolean };
      payment_method_update?: { enabled: boolean };
      invoice_history?: { enabled: boolean };
    };
  };
}

interface PortalSessionResponse {
  id: string;
  object: 'billing_portal.session';
  customer: string;
  url: string;
  return_url: string;
  created: number;
  expires_at: number;
  configuration: {
    features: {
      subscription_cancel: { enabled: boolean };
      subscription_pause: { enabled: boolean };
      payment_method_update: { enabled: boolean };
      invoice_history: { enabled: boolean };
    };
  };
}

function formatPortalSession(session: any): PortalSessionResponse {
  const hostedUrl = `${Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io'}/portal/${session.id}`;

  return {
    id: session.id,
    object: 'billing_portal.session',
    customer: session.customer_id,
    url: hostedUrl,
    return_url: session.return_url,
    created: Math.floor(new Date(session.created_at).getTime() / 1000),
    expires_at: Math.floor(new Date(session.expires_at).getTime() / 1000),
    configuration: {
      features: {
        subscription_cancel: { enabled: session.allow_subscription_cancel },
        subscription_pause: { enabled: session.allow_subscription_pause },
        payment_method_update: { enabled: session.allow_payment_method_update },
        invoice_history: { enabled: session.allow_invoice_history },
      },
    },
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate
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
    const sessionId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /portal-sessions - Create portal session
    if (req.method === 'POST' && !sessionId) {
      const body: CreatePortalSessionRequest = await req.json();

      // Validate required fields
      if (!body.customer) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'customer is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.return_url) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'return_url is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify customer exists and belongs to tenant
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('id', body.customer)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set defaults for features
      const features = body.configuration?.features || {};
      const allowSubscriptionCancel = features.subscription_cancel?.enabled ?? true;
      const allowSubscriptionPause = features.subscription_pause?.enabled ?? true;
      const allowPaymentMethodUpdate = features.payment_method_update?.enabled ?? true;
      const allowInvoiceHistory = features.invoice_history?.enabled ?? true;

      // Set expiration (default 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Create portal session
      const { data: session, error: sessionError } = await supabase
        .from('portal_sessions')
        .insert({
          tenant_id: auth.tenantId,
          customer_id: body.customer,
          return_url: body.return_url,
          allow_subscription_cancel: allowSubscriptionCancel,
          allow_subscription_pause: allowSubscriptionPause,
          allow_payment_method_update: allowPaymentMethodUpdate,
          allow_invoice_history: allowInvoiceHistory,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (sessionError) {
        console.error('[PortalSessions] Create error:', sessionError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create portal session' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatPortalSession(session)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /portal-sessions/:id - Get portal session
    if (req.method === 'GET' && sessionId) {
      const { data: session, error } = await supabase
        .from('portal_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (error || !session) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Portal session not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      if (expiresAt < now) {
        return new Response(
          JSON.stringify({ error: { code: 'session_expired', message: 'Portal session has expired' } }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatPortalSession(session)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[PortalSessions] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
