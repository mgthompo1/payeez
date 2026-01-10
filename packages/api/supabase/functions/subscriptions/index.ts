/**
 * Subscriptions API
 *
 * CRUD operations for subscription management.
 * Subscriptions represent recurring billing relationships between customers and products.
 *
 * Routes:
 *   POST   /subscriptions              - Create a subscription
 *   GET    /subscriptions              - List subscriptions
 *   GET    /subscriptions/:id          - Get a subscription
 *   PATCH  /subscriptions/:id          - Update a subscription
 *   DELETE /subscriptions/:id          - Cancel a subscription
 *   POST   /subscriptions/:id/pause    - Pause a subscription
 *   POST   /subscriptions/:id/resume   - Resume a paused subscription
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface SubscriptionItem {
  price: string; // price ID
  quantity?: number;
}

interface CreateSubscriptionRequest {
  customer: string; // customer ID
  items: SubscriptionItem[];
  trial_period_days?: number;
  trial_end?: number; // Unix timestamp
  billing_cycle_anchor?: number; // Unix timestamp
  cancel_at_period_end?: boolean;
  collection_method?: 'charge_automatically' | 'send_invoice';
  days_until_due?: number;
  default_payment_method?: string;
  metadata?: Record<string, string>;
}

interface UpdateSubscriptionRequest {
  cancel_at_period_end?: boolean;
  default_payment_method?: string;
  metadata?: Record<string, string>;
  proration_behavior?: 'create_prorations' | 'none';
  items?: SubscriptionItem[];
}

interface SubscriptionItemResponse {
  id: string;
  object: 'subscription_item';
  price: {
    id: string;
    product: string;
    unit_amount: number | null;
    currency: string;
    recurring: {
      interval: string;
      interval_count: number;
    } | null;
  };
  quantity: number;
  created: number;
}

interface SubscriptionResponse {
  id: string;
  object: 'subscription';
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  trial_start: number | null;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  collection_method: string;
  days_until_due: number | null;
  default_payment_method: string | null;
  items: {
    object: 'list';
    data: SubscriptionItemResponse[];
  };
  latest_invoice: string | null;
  metadata: Record<string, string>;
  created: number;
}

function calculatePeriodEnd(start: Date, interval: string, intervalCount: number): Date {
  const end = new Date(start);
  switch (interval) {
    case 'day':
      end.setDate(end.getDate() + intervalCount);
      break;
    case 'week':
      end.setDate(end.getDate() + (7 * intervalCount));
      break;
    case 'month':
      end.setMonth(end.getMonth() + intervalCount);
      break;
    case 'year':
      end.setFullYear(end.getFullYear() + intervalCount);
      break;
  }
  return end;
}

function formatSubscriptionItem(item: any, price: any): SubscriptionItemResponse {
  return {
    id: item.id,
    object: 'subscription_item',
    price: {
      id: price.id,
      product: price.product_id,
      unit_amount: price.unit_amount,
      currency: price.currency,
      recurring: price.type === 'recurring' ? {
        interval: price.recurring_interval,
        interval_count: price.recurring_interval_count,
      } : null,
    },
    quantity: item.quantity,
    created: Math.floor(new Date(item.created_at).getTime() / 1000),
  };
}

function formatSubscription(subscription: any, items: any[], prices: Record<string, any>): SubscriptionResponse {
  return {
    id: subscription.id,
    object: 'subscription',
    customer: subscription.customer_id,
    status: subscription.status,
    current_period_start: Math.floor(new Date(subscription.current_period_start).getTime() / 1000),
    current_period_end: Math.floor(new Date(subscription.current_period_end).getTime() / 1000),
    trial_start: subscription.trial_start ? Math.floor(new Date(subscription.trial_start).getTime() / 1000) : null,
    trial_end: subscription.trial_end ? Math.floor(new Date(subscription.trial_end).getTime() / 1000) : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? Math.floor(new Date(subscription.canceled_at).getTime() / 1000) : null,
    ended_at: subscription.ended_at ? Math.floor(new Date(subscription.ended_at).getTime() / 1000) : null,
    collection_method: subscription.collection_method,
    days_until_due: subscription.days_until_due,
    default_payment_method: subscription.default_token_id,
    items: {
      object: 'list',
      data: items.map(item => formatSubscriptionItem(item, prices[item.price_id])),
    },
    latest_invoice: subscription.latest_invoice_id,
    metadata: subscription.metadata || {},
    created: Math.floor(new Date(subscription.created_at).getTime() / 1000),
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  // Handle CORS preflight
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

    // Extract subscription ID and action from path
    const subscriptionId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Route: POST /subscriptions/:id/pause - Pause subscription
    if (req.method === 'POST' && subscriptionId && action === 'pause') {
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', subscriptionId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (subscription.status !== 'active') {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Only active subscriptions can be paused' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'pause_failed', message: 'Failed to pause subscription' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch updated subscription with items
      const { data: updated } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      const { data: items } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .eq('subscription_id', subscriptionId);

      const prices: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        prices[item.price_id] = item.prices;
      });

      return new Response(
        JSON.stringify(formatSubscription(updated, items || [], prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /subscriptions/:id/resume - Resume subscription
    if (req.method === 'POST' && subscriptionId && action === 'resume') {
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', subscriptionId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (subscription.status !== 'paused') {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Only paused subscriptions can be resumed' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'active', paused_at: null, resumed_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'resume_failed', message: 'Failed to resume subscription' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch updated subscription with items
      const { data: updated } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      const { data: items } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .eq('subscription_id', subscriptionId);

      const prices: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        prices[item.price_id] = item.prices;
      });

      return new Response(
        JSON.stringify(formatSubscription(updated, items || [], prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /subscriptions - Create subscription
    if (req.method === 'POST' && !subscriptionId) {
      const body: CreateSubscriptionRequest = await req.json();

      // Validate required fields
      if (!body.customer) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'customer is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.items || body.items.length === 0) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'at least one item is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify customer exists and belongs to tenant
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, tenant_id, default_token_id')
        .eq('id', body.customer)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify all prices exist and are recurring
      const priceIds = body.items.map(item => item.price);
      const { data: pricesData, error: pricesError } = await supabase
        .from('prices')
        .select('*, products!inner(tenant_id)')
        .in('id', priceIds)
        .eq('products.tenant_id', auth.tenantId);

      if (pricesError || !pricesData || pricesData.length !== priceIds.length) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'One or more prices not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check all prices are recurring
      const nonRecurring = pricesData.find((p: any) => p.type !== 'recurring');
      if (nonRecurring) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'All prices must be recurring for subscriptions' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate billing period based on first price's interval
      const primaryPrice = pricesData[0];
      const now = new Date();
      let periodStart = body.billing_cycle_anchor ? new Date(body.billing_cycle_anchor * 1000) : now;

      // Handle trial period
      let trialStart: Date | null = null;
      let trialEnd: Date | null = null;
      let status = 'active';

      if (body.trial_end) {
        trialStart = now;
        trialEnd = new Date(body.trial_end * 1000);
        status = 'trialing';
        periodStart = trialEnd;
      } else if (body.trial_period_days && body.trial_period_days > 0) {
        trialStart = now;
        trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + body.trial_period_days);
        status = 'trialing';
        periodStart = trialEnd;
      }

      const periodEnd = calculatePeriodEnd(
        periodStart,
        primaryPrice.recurring_interval,
        primaryPrice.recurring_interval_count
      );

      // Create subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: auth.tenantId,
          customer_id: body.customer,
          status,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_start: trialStart?.toISOString() || null,
          trial_end: trialEnd?.toISOString() || null,
          cancel_at_period_end: body.cancel_at_period_end || false,
          collection_method: body.collection_method || 'charge_automatically',
          days_until_due: body.days_until_due || null,
          default_token_id: body.default_payment_method || customer.default_token_id,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (subError) {
        console.error('[Subscriptions] Create error:', subError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create subscription' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create subscription items
      const itemsToInsert = body.items.map(item => ({
        subscription_id: subscription.id,
        price_id: item.price,
        quantity: item.quantity || 1,
      }));

      const { data: items, error: itemsError } = await supabase
        .from('subscription_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('[Subscriptions] Create items error:', itemsError);
        // Rollback subscription
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create subscription items' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build prices map
      const prices: Record<string, any> = {};
      pricesData.forEach((price: any) => {
        prices[price.id] = price;
      });

      return new Response(
        JSON.stringify(formatSubscription(subscription, items || [], prices)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /subscriptions - List subscriptions
    if (req.method === 'GET' && !subscriptionId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const customerId = url.searchParams.get('customer');
      const status = url.searchParams.get('status');

      let query = supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)', { count: 'exact' })
        .eq('customers.tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data: subscriptions, error, count } = await query;

      if (error) {
        console.error('[Subscriptions] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list subscriptions' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all items for these subscriptions
      const subscriptionIds = (subscriptions || []).map((s: any) => s.id);
      const { data: allItems } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .in('subscription_id', subscriptionIds);

      // Group items by subscription
      const itemsBySubscription: Record<string, any[]> = {};
      const prices: Record<string, any> = {};
      (allItems || []).forEach((item: any) => {
        if (!itemsBySubscription[item.subscription_id]) {
          itemsBySubscription[item.subscription_id] = [];
        }
        itemsBySubscription[item.subscription_id].push(item);
        prices[item.price_id] = item.prices;
      });

      const formattedSubscriptions = (subscriptions || []).map((sub: any) =>
        formatSubscription(sub, itemsBySubscription[sub.id] || [], prices)
      );

      return new Response(
        JSON.stringify({
          object: 'list',
          data: formattedSubscriptions,
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /subscriptions/:id - Get subscription
    if (req.method === 'GET' && subscriptionId && !action) {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', subscriptionId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (error || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch items with prices
      const { data: items } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .eq('subscription_id', subscriptionId);

      const prices: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        prices[item.price_id] = item.prices;
      });

      return new Response(
        JSON.stringify(formatSubscription(subscription, items || [], prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /subscriptions/:id - Update subscription
    if (req.method === 'PATCH' && subscriptionId) {
      const body: UpdateSubscriptionRequest = await req.json();

      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', subscriptionId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (body.cancel_at_period_end !== undefined) updateData.cancel_at_period_end = body.cancel_at_period_end;
      if (body.default_payment_method !== undefined) updateData.default_token_id = body.default_payment_method;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscriptionId);

      if (updateError) {
        console.error('[Subscriptions] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update subscription' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle item updates if provided
      if (body.items && body.items.length > 0) {
        // For simplicity, we'll replace all items (a more complete implementation would handle prorations)
        await supabase.from('subscription_items').delete().eq('subscription_id', subscriptionId);

        const itemsToInsert = body.items.map(item => ({
          subscription_id: subscriptionId,
          price_id: item.price,
          quantity: item.quantity || 1,
        }));

        await supabase.from('subscription_items').insert(itemsToInsert);
      }

      // Fetch updated subscription
      const { data: updated } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      const { data: items } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .eq('subscription_id', subscriptionId);

      const prices: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        prices[item.price_id] = item.prices;
      });

      return new Response(
        JSON.stringify(formatSubscription(updated, items || [], prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /subscriptions/:id - Cancel subscription
    if (req.method === 'DELETE' && subscriptionId) {
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', subscriptionId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (subscription.status === 'canceled') {
        return new Response(
          JSON.stringify({ error: { code: 'already_canceled', message: 'Subscription is already canceled' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);

      if (error) {
        console.error('[Subscriptions] Cancel error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'cancel_failed', message: 'Failed to cancel subscription' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch updated subscription
      const { data: updated } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      const { data: items } = await supabase
        .from('subscription_items')
        .select('*, prices(*)')
        .eq('subscription_id', subscriptionId);

      const prices: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        prices[item.price_id] = item.prices;
      });

      return new Response(
        JSON.stringify(formatSubscription(updated, items || [], prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Subscriptions] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
