/**
 * Prices API
 *
 * CRUD operations for price management.
 * Prices define how to charge for products (one-time, recurring, tiered, metered).
 *
 * Routes:
 *   POST   /prices              - Create a price
 *   GET    /prices              - List prices
 *   GET    /prices/:id          - Get a price
 *   PATCH  /prices/:id          - Update a price
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface Tier {
  up_to: number | null; // null means infinity
  unit_amount?: number;
  flat_amount?: number;
}

interface CreatePriceRequest {
  product: string; // product ID
  currency: string;
  unit_amount?: number; // in cents
  type?: 'one_time' | 'recurring';
  billing_scheme?: 'per_unit' | 'tiered';
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
    usage_type?: 'licensed' | 'metered';
    aggregate_usage?: 'sum' | 'max' | 'last_during_period' | 'last_ever';
  };
  tiers?: Tier[];
  tiers_mode?: 'graduated' | 'volume';
  nickname?: string;
  is_active?: boolean;
  metadata?: Record<string, string>;
}

interface UpdatePriceRequest {
  nickname?: string;
  is_active?: boolean;
  metadata?: Record<string, string>;
}

interface PriceResponse {
  id: string;
  object: 'price';
  product: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  type: 'one_time' | 'recurring';
  billing_scheme: 'per_unit' | 'tiered';
  recurring: {
    interval: string;
    interval_count: number;
    usage_type: string;
    aggregate_usage: string | null;
  } | null;
  tiers: Tier[] | null;
  tiers_mode: string | null;
  nickname: string | null;
  metadata: Record<string, string>;
  created: number;
}

function formatPrice(price: any): PriceResponse {
  return {
    id: price.id,
    object: 'price',
    product: price.product_id,
    active: price.is_active,
    currency: price.currency,
    unit_amount: price.unit_amount,
    type: price.type,
    billing_scheme: price.billing_scheme,
    recurring: price.type === 'recurring' ? {
      interval: price.recurring_interval,
      interval_count: price.recurring_interval_count,
      usage_type: price.recurring_usage_type,
      aggregate_usage: price.recurring_aggregate_usage,
    } : null,
    tiers: price.tiers,
    tiers_mode: price.tiers_mode,
    nickname: price.nickname,
    metadata: price.metadata || {},
    created: Math.floor(new Date(price.created_at).getTime() / 1000),
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

    // Extract price ID from path if present
    const priceId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /prices - Create price
    if (req.method === 'POST' && !priceId) {
      const body: CreatePriceRequest = await req.json();

      // Validate required fields
      if (!body.product) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'product is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.currency) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'currency is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify product exists and belongs to tenant
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, tenant_id')
        .eq('id', body.product)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (productError || !product) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Product not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const priceType = body.type || 'one_time';
      const billingScheme = body.billing_scheme || 'per_unit';

      // Validate per_unit pricing has unit_amount
      if (billingScheme === 'per_unit' && body.unit_amount === undefined) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'unit_amount is required for per_unit pricing' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate tiered pricing has tiers
      if (billingScheme === 'tiered' && (!body.tiers || body.tiers.length === 0)) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'tiers are required for tiered pricing' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate recurring config
      if (priceType === 'recurring' && !body.recurring) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'recurring configuration is required for recurring prices' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate metered billing requires aggregate_usage
      if (body.recurring?.usage_type === 'metered' && !body.recurring?.aggregate_usage) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'aggregate_usage is required for metered pricing' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create price
      const insertData: Record<string, unknown> = {
        product_id: body.product,
        type: priceType,
        billing_scheme: billingScheme,
        currency: body.currency.toLowerCase(),
        unit_amount: billingScheme === 'per_unit' ? body.unit_amount : null,
        is_active: body.is_active !== false,
        nickname: body.nickname || null,
        metadata: body.metadata || {},
      };

      // Add tiered pricing fields
      if (billingScheme === 'tiered') {
        insertData.tiers = body.tiers;
        insertData.tiers_mode = body.tiers_mode || 'graduated';
      }

      // Add recurring fields
      if (priceType === 'recurring' && body.recurring) {
        insertData.recurring_interval = body.recurring.interval;
        insertData.recurring_interval_count = body.recurring.interval_count || 1;
        insertData.recurring_usage_type = body.recurring.usage_type || 'licensed';
        if (body.recurring.usage_type === 'metered') {
          insertData.recurring_aggregate_usage = body.recurring.aggregate_usage;
        }
      }

      const { data: price, error } = await supabase
        .from('prices')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[Prices] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create price' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatPrice(price)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /prices - List prices
    if (req.method === 'GET' && !priceId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const productId = url.searchParams.get('product');
      const active = url.searchParams.get('active');
      const type = url.searchParams.get('type');

      // Get products for this tenant to filter prices
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', auth.tenantId);

      const productIds = (products || []).map(p => p.id);

      if (productIds.length === 0) {
        return new Response(
          JSON.stringify({
            object: 'list',
            data: [],
            has_more: false,
            total_count: 0,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let query = supabase
        .from('prices')
        .select('*', { count: 'exact' })
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      if (active !== null) {
        query = query.eq('is_active', active === 'true');
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: prices, error, count } = await query;

      if (error) {
        console.error('[Prices] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list prices' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (prices || []).map(formatPrice),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /prices/:id - Get price
    if (req.method === 'GET' && priceId) {
      // Get products for this tenant to verify ownership
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', auth.tenantId);

      const productIds = (products || []).map(p => p.id);

      const { data: price, error } = await supabase
        .from('prices')
        .select('*')
        .eq('id', priceId)
        .in('product_id', productIds)
        .single();

      if (error || !price) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Price not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatPrice(price)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /prices/:id - Update price
    // Note: Most price fields are immutable. Only nickname, is_active, and metadata can be updated.
    if (req.method === 'PATCH' && priceId) {
      const body: UpdatePriceRequest = await req.json();

      // Get products for this tenant to verify ownership
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', auth.tenantId);

      const productIds = (products || []).map(p => p.id);

      // Check price exists
      const { data: existing } = await supabase
        .from('prices')
        .select('id')
        .eq('id', priceId)
        .in('product_id', productIds)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Price not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build update object (only mutable fields)
      const updateData: Record<string, unknown> = {};
      if (body.nickname !== undefined) updateData.nickname = body.nickname;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const { data: price, error } = await supabase
        .from('prices')
        .update(updateData)
        .eq('id', priceId)
        .select()
        .single();

      if (error) {
        console.error('[Prices] Update error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update price' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatPrice(price)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Prices] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
