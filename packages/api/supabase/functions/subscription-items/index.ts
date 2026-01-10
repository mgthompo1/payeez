/**
 * Subscription Items API
 *
 * Manage individual items on a subscription.
 *
 * Routes:
 *   POST   /subscription-items              - Add an item to a subscription
 *   GET    /subscription-items/:id          - Get a subscription item
 *   PATCH  /subscription-items/:id          - Update a subscription item
 *   DELETE /subscription-items/:id          - Remove a subscription item
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreateItemRequest {
  subscription: string;
  price: string;
  quantity?: number;
  proration_behavior?: 'create_prorations' | 'none';
}

interface UpdateItemRequest {
  quantity?: number;
  proration_behavior?: 'create_prorations' | 'none';
}

interface SubscriptionItemResponse {
  id: string;
  object: 'subscription_item';
  subscription: string;
  price: {
    id: string;
    object: 'price';
    product: string;
    unit_amount: number | null;
    currency: string;
    type: string;
    recurring: {
      interval: string;
      interval_count: number;
    } | null;
  };
  quantity: number;
  created: number;
}

function formatItem(item: any, price: any): SubscriptionItemResponse {
  return {
    id: item.id,
    object: 'subscription_item',
    subscription: item.subscription_id,
    price: {
      id: price.id,
      object: 'price',
      product: price.product_id,
      unit_amount: price.unit_amount,
      currency: price.currency,
      type: price.type,
      recurring: price.type === 'recurring' ? {
        interval: price.recurring_interval,
        interval_count: price.recurring_interval_count,
      } : null,
    },
    quantity: item.quantity,
    created: Math.floor(new Date(item.created_at).getTime() / 1000),
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

    // Extract item ID from path if present
    const itemId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /subscription-items - Add item to subscription
    if (req.method === 'POST' && !itemId) {
      const body: CreateItemRequest = await req.json();

      // Validate required fields
      if (!body.subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'subscription is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.price) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'price is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription exists and belongs to tenant
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*, customers!inner(tenant_id)')
        .eq('id', body.subscription)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (subError || !subscription) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription is active
      if (!['active', 'trialing'].includes(subscription.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Cannot add items to inactive subscription' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify price exists and is recurring
      const { data: price, error: priceError } = await supabase
        .from('prices')
        .select('*, products!inner(tenant_id)')
        .eq('id', body.price)
        .eq('products.tenant_id', auth.tenantId)
        .single();

      if (priceError || !price) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Price not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (price.type !== 'recurring') {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'Price must be recurring' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create subscription item
      const { data: item, error: itemError } = await supabase
        .from('subscription_items')
        .insert({
          subscription_id: body.subscription,
          price_id: body.price,
          quantity: body.quantity || 1,
        })
        .select()
        .single();

      if (itemError) {
        console.error('[SubscriptionItems] Create error:', itemError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create subscription item' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatItem(item, price)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /subscription-items/:id - Get subscription item
    if (req.method === 'GET' && itemId) {
      const { data: item, error } = await supabase
        .from('subscription_items')
        .select('*, prices(*), subscriptions!inner(customers!inner(tenant_id))')
        .eq('id', itemId)
        .single();

      if (error || !item) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify tenant ownership
      if (item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatItem(item, item.prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /subscription-items/:id - Update subscription item
    if (req.method === 'PATCH' && itemId) {
      const body: UpdateItemRequest = await req.json();

      const { data: item, error: fetchError } = await supabase
        .from('subscription_items')
        .select('*, prices(*), subscriptions!inner(status, customers!inner(tenant_id))')
        .eq('id', itemId)
        .single();

      if (fetchError || !item) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify tenant ownership
      if (item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription is active
      if (!['active', 'trialing'].includes(item.subscriptions?.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Cannot update items on inactive subscription' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (body.quantity !== undefined) updateData.quantity = body.quantity;

      const { data: updated, error: updateError } = await supabase
        .from('subscription_items')
        .update(updateData)
        .eq('id', itemId)
        .select('*, prices(*)')
        .single();

      if (updateError) {
        console.error('[SubscriptionItems] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update subscription item' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatItem(updated, updated.prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /subscription-items/:id - Remove subscription item
    if (req.method === 'DELETE' && itemId) {
      const { data: item, error: fetchError } = await supabase
        .from('subscription_items')
        .select('*, prices(*), subscriptions!inner(status, customers!inner(tenant_id))')
        .eq('id', itemId)
        .single();

      if (fetchError || !item) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify tenant ownership
      if (item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this is the last item
      const { count } = await supabase
        .from('subscription_items')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', item.subscription_id);

      if (count === 1) {
        return new Response(
          JSON.stringify({ error: { code: 'last_item', message: 'Cannot remove the last item from a subscription. Cancel the subscription instead.' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('subscription_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) {
        console.error('[SubscriptionItems] Delete error:', deleteError);
        return new Response(
          JSON.stringify({ error: { code: 'delete_failed', message: 'Failed to remove subscription item' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ id: itemId, object: 'subscription_item', deleted: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[SubscriptionItems] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
