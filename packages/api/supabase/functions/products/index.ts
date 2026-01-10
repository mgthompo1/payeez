/**
 * Products API
 *
 * CRUD operations for product management.
 * Products represent what merchants sell (subscription tiers, add-ons, etc.)
 *
 * Routes:
 *   POST   /products              - Create a product
 *   GET    /products              - List products
 *   GET    /products/:id          - Get a product
 *   PATCH  /products/:id          - Update a product
 *   DELETE /products/:id          - Archive/delete a product
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreateProductRequest {
  name: string;
  description?: string;
  statement_descriptor?: string;
  unit_label?: string;
  images?: string[];
  is_active?: boolean;
  metadata?: Record<string, string>;
}

interface UpdateProductRequest {
  name?: string;
  description?: string;
  statement_descriptor?: string;
  unit_label?: string;
  images?: string[];
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
  tiers: any[] | null;
  tiers_mode: string | null;
  nickname: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface ProductResponse {
  id: string;
  object: 'product';
  name: string;
  description: string | null;
  statement_descriptor: string | null;
  unit_label: string | null;
  images: string[];
  active: boolean;
  default_price: string | null;
  prices?: PriceResponse[];
  metadata: Record<string, string>;
  created: number;
  updated: number;
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

function formatProduct(product: any, prices?: any[]): ProductResponse {
  // Find default price (first active recurring price, or first active price)
  let defaultPrice: string | null = null;
  if (prices && prices.length > 0) {
    const activeRecurring = prices.find((p: any) => p.is_active && p.type === 'recurring');
    const activePrice = prices.find((p: any) => p.is_active);
    defaultPrice = (activeRecurring?.id || activePrice?.id) || null;
  }

  return {
    id: product.id,
    object: 'product',
    name: product.name,
    description: product.description,
    statement_descriptor: product.statement_descriptor,
    unit_label: product.unit_label,
    images: product.images || [],
    active: product.is_active,
    default_price: defaultPrice,
    prices: prices ? prices.map(formatPrice) : undefined,
    metadata: product.metadata || {},
    created: Math.floor(new Date(product.created_at).getTime() / 1000),
    updated: Math.floor(new Date(product.updated_at).getTime() / 1000),
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

    // Extract product ID from path if present
    const productId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /products - Create product
    if (req.method === 'POST' && !productId) {
      const body: CreateProductRequest = await req.json();

      // Validate required fields
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'name is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create product
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          tenant_id: auth.tenantId,
          name: body.name,
          description: body.description,
          statement_descriptor: body.statement_descriptor,
          unit_label: body.unit_label,
          images: body.images || [],
          is_active: body.is_active !== false,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Products] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create product' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatProduct(product)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /products - List products
    if (req.method === 'GET' && !productId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const active = url.searchParams.get('active');
      const expand = url.searchParams.get('expand');

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (active !== null) {
        query = query.eq('is_active', active === 'true');
      }

      const { data: products, error, count } = await query;

      if (error) {
        console.error('[Products] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list products' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Expand prices if requested
      let formattedProducts = (products || []).map(p => formatProduct(p));

      if (expand === 'prices' && products && products.length > 0) {
        const productIds = products.map((p: any) => p.id);
        const { data: prices } = await supabase
          .from('prices')
          .select('*')
          .in('product_id', productIds)
          .order('created_at', { ascending: false });

        const pricesByProduct: Record<string, any[]> = {};
        (prices || []).forEach((price: any) => {
          if (!pricesByProduct[price.product_id]) {
            pricesByProduct[price.product_id] = [];
          }
          pricesByProduct[price.product_id].push(price);
        });

        formattedProducts = products.map(p => formatProduct(p, pricesByProduct[p.id]));
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: formattedProducts,
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /products/:id - Get product
    if (req.method === 'GET' && productId) {
      const expand = url.searchParams.get('expand');

      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', productId)
        .single();

      if (error || !product) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Product not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Expand prices if requested
      let prices = undefined;
      if (expand === 'prices') {
        const { data: priceData } = await supabase
          .from('prices')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false });
        prices = priceData || [];
      }

      return new Response(
        JSON.stringify(formatProduct(product, prices)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /products/:id - Update product
    if (req.method === 'PATCH' && productId) {
      const body: UpdateProductRequest = await req.json();

      // Check product exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', productId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Product not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.statement_descriptor !== undefined) updateData.statement_descriptor = body.statement_descriptor;
      if (body.unit_label !== undefined) updateData.unit_label = body.unit_label;
      if (body.images !== undefined) updateData.images = body.images;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const { data: product, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        console.error('[Products] Update error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update product' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatProduct(product)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /products/:id - Delete/archive product
    if (req.method === 'DELETE' && productId) {
      // Check product exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', productId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Product not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for active subscriptions using this product's prices
      const { data: activeSubs } = await supabase
        .from('subscription_items')
        .select('id, prices!inner(product_id)')
        .eq('prices.product_id', productId)
        .limit(1);

      // If there are active subscriptions, just archive (set inactive)
      if (activeSubs && activeSubs.length > 0) {
        const { error } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);

        if (error) {
          console.error('[Products] Archive error:', error);
          return new Response(
            JSON.stringify({ error: { code: 'archive_failed', message: 'Failed to archive product' } }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ id: productId, object: 'product', deleted: false, archived: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No active subscriptions, can delete
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        console.error('[Products] Delete error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'delete_failed', message: 'Failed to delete product' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ id: productId, object: 'product', deleted: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Products] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
