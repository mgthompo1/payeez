/**
 * Checkout Sessions API
 *
 * Create hosted checkout sessions for one-time payments and subscriptions.
 *
 * Routes:
 *   POST /checkout-sessions     - Create a checkout session
 *   GET  /checkout-sessions/:id - Get a checkout session
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface LineItem {
  price: string;
  quantity?: number;
}

interface CreateCheckoutSessionRequest {
  mode: 'payment' | 'subscription';
  line_items: LineItem[];
  customer?: string;
  customer_email?: string;
  success_url: string;
  cancel_url: string;
  allow_promotion_codes?: boolean;
  discounts?: Array<{ coupon: string }>;
  subscription_data?: {
    trial_period_days?: number;
  };
  metadata?: Record<string, string>;
  expires_at?: number; // Unix timestamp
}

interface CheckoutSessionResponse {
  id: string;
  object: 'checkout.session';
  mode: string;
  status: string;
  url: string;
  customer: string | null;
  customer_email: string | null;
  payment_status: string;
  amount_total: number;
  currency: string;
  line_items: {
    object: 'list';
    data: Array<{
      price: string;
      quantity: number;
      amount_total: number;
    }>;
  };
  subscription: string | null;
  success_url: string;
  cancel_url: string;
  expires_at: number;
  metadata: Record<string, string>;
  created: number;
}

function formatCheckoutSession(session: any, lineItems: any[]): CheckoutSessionResponse {
  const hostedUrl = `${Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io'}/checkout/${session.access_token}`;

  // Calculate totals from line items
  const amountTotal = lineItems.reduce((sum, item) => sum + (item.amount_total || 0), 0);
  const currency = lineItems[0]?.currency || 'usd';

  return {
    id: session.id,
    object: 'checkout.session',
    mode: session.mode,
    status: session.status,
    url: hostedUrl,
    customer: session.customer_id,
    customer_email: session.customer_email,
    payment_status: session.payment_session_id ? 'paid' : 'unpaid',
    amount_total: amountTotal,
    currency,
    line_items: {
      object: 'list',
      data: lineItems.map(item => ({
        price: item.price_id,
        quantity: item.quantity,
        amount_total: item.amount_total,
      })),
    },
    subscription: session.subscription_id,
    success_url: session.success_url,
    cancel_url: session.cancel_url,
    expires_at: Math.floor(new Date(session.expires_at).getTime() / 1000),
    metadata: session.metadata || {},
    created: Math.floor(new Date(session.created_at).getTime() / 1000),
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

    // Route: POST /checkout-sessions - Create checkout session
    if (req.method === 'POST' && !sessionId) {
      const body: CreateCheckoutSessionRequest = await req.json();

      // Validate required fields
      if (!body.mode) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'mode is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.line_items || body.line_items.length === 0) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'line_items is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.success_url || !body.cancel_url) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'success_url and cancel_url are required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify customer if provided
      let customerId = body.customer || null;
      if (customerId) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('id', customerId)
          .eq('tenant_id', auth.tenantId)
          .single();

        if (customerError || !customer) {
          return new Response(
            JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Fetch all prices
      const priceIds = body.line_items.map(item => item.price);
      const { data: prices, error: pricesError } = await supabase
        .from('prices')
        .select('*, products!inner(tenant_id)')
        .in('id', priceIds)
        .eq('products.tenant_id', auth.tenantId);

      if (pricesError || !prices || prices.length !== priceIds.length) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'One or more prices not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate prices match mode
      if (body.mode === 'subscription') {
        const nonRecurring = prices.find(p => p.type !== 'recurring');
        if (nonRecurring) {
          return new Response(
            JSON.stringify({ error: { code: 'validation_error', message: 'Subscription mode requires recurring prices' } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Calculate totals
      let amountTotal = 0;
      const currency = prices[0].currency;
      const lineItemsData: any[] = [];

      for (const item of body.line_items) {
        const price = prices.find(p => p.id === item.price);
        const quantity = item.quantity || 1;
        const itemTotal = (price?.unit_amount || 0) * quantity;
        amountTotal += itemTotal;

        lineItemsData.push({
          price_id: item.price,
          quantity,
          amount_total: itemTotal,
        });
      }

      // Set expiration (default 24 hours)
      const expiresAt = body.expires_at
        ? new Date(body.expires_at * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Generate access token
      const accessToken = crypto.randomUUID();

      // Create checkout session
      const { data: session, error: sessionError } = await supabase
        .from('checkout_sessions')
        .insert({
          tenant_id: auth.tenantId,
          mode: body.mode,
          status: 'open',
          customer_id: customerId,
          customer_email: body.customer_email || null,
          line_items: lineItemsData,
          success_url: body.success_url,
          cancel_url: body.cancel_url,
          discounts: body.discounts || [],
          subscription_data: body.subscription_data ? {
            trial_period_days: body.subscription_data.trial_period_days,
          } : null,
          access_token: accessToken,
          expires_at: expiresAt.toISOString(),
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (sessionError) {
        console.error('[CheckoutSessions] Create error:', sessionError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create checkout session' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCheckoutSession(session, lineItemsData)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /checkout-sessions/:id - Get checkout session
    if (req.method === 'GET' && sessionId) {
      const { data: session, error } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (error || !session) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Checkout session not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCheckoutSession(session, session.line_items || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[CheckoutSessions] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
