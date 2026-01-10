/**
 * Coupons API
 *
 * CRUD operations for coupon/discount management.
 *
 * Routes:
 *   POST   /coupons              - Create a coupon
 *   GET    /coupons              - List coupons
 *   GET    /coupons/:id          - Get a coupon
 *   PATCH  /coupons/:id          - Update a coupon
 *   DELETE /coupons/:id          - Delete a coupon
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreateCouponRequest {
  id?: string; // Custom coupon code
  name?: string;
  percent_off?: number; // 0-100
  amount_off?: number; // In cents
  currency?: string; // Required if amount_off
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months?: number; // Required if duration is 'repeating'
  max_redemptions?: number;
  redeem_by?: number; // Unix timestamp
  applies_to?: {
    products?: string[];
  };
  metadata?: Record<string, string>;
}

interface UpdateCouponRequest {
  name?: string;
  metadata?: Record<string, string>;
}

interface CouponResponse {
  id: string;
  object: 'coupon';
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  redeem_by: number | null;
  applies_to: {
    products: string[];
  } | null;
  valid: boolean;
  metadata: Record<string, string>;
  created: number;
}

function formatCoupon(coupon: any): CouponResponse {
  const now = new Date();
  const redeemBy = coupon.redeem_by ? new Date(coupon.redeem_by) : null;
  const isExpired = redeemBy && redeemBy < now;
  const maxReached = coupon.max_redemptions && coupon.times_redeemed >= coupon.max_redemptions;

  return {
    id: coupon.id,
    object: 'coupon',
    name: coupon.name,
    percent_off: coupon.percent_off,
    amount_off: coupon.amount_off,
    currency: coupon.currency,
    duration: coupon.duration,
    duration_in_months: coupon.duration_in_months,
    max_redemptions: coupon.max_redemptions,
    times_redeemed: coupon.times_redeemed || 0,
    redeem_by: redeemBy ? Math.floor(redeemBy.getTime() / 1000) : null,
    applies_to: coupon.applies_to_products?.length > 0 ? {
      products: coupon.applies_to_products,
    } : null,
    valid: coupon.is_active && !isExpired && !maxReached,
    metadata: coupon.metadata || {},
    created: Math.floor(new Date(coupon.created_at).getTime() / 1000),
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
    const couponId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /coupons - Create coupon
    if (req.method === 'POST' && !couponId) {
      const body: CreateCouponRequest = await req.json();

      // Validate required fields
      if (!body.duration) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'duration is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.percent_off && !body.amount_off) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'either percent_off or amount_off is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.percent_off && body.amount_off) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'cannot specify both percent_off and amount_off' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.percent_off && (body.percent_off < 0 || body.percent_off > 100)) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'percent_off must be between 0 and 100' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.amount_off && !body.currency) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'currency is required when using amount_off' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.duration === 'repeating' && !body.duration_in_months) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'duration_in_months is required for repeating duration' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate coupon ID if not provided
      const couponCode = body.id || `COUPON_${Date.now().toString(36).toUpperCase()}`;

      // Check for duplicate ID
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', couponCode)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ error: { code: 'coupon_exists', message: 'A coupon with this ID already exists' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: coupon, error } = await supabase
        .from('coupons')
        .insert({
          id: couponCode,
          tenant_id: auth.tenantId,
          name: body.name || null,
          percent_off: body.percent_off || null,
          amount_off: body.amount_off || null,
          currency: body.currency?.toLowerCase() || null,
          duration: body.duration,
          duration_in_months: body.duration_in_months || null,
          max_redemptions: body.max_redemptions || null,
          redeem_by: body.redeem_by ? new Date(body.redeem_by * 1000).toISOString() : null,
          applies_to_products: body.applies_to?.products || [],
          is_active: true,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Coupons] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create coupon' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCoupon(coupon)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /coupons - List coupons
    if (req.method === 'GET' && !couponId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const { data: coupons, error, count } = await supabase
        .from('coupons')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Coupons] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list coupons' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (coupons || []).map(formatCoupon),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /coupons/:id - Get coupon
    if (req.method === 'GET' && couponId) {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', couponId)
        .single();

      if (error || !coupon) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Coupon not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCoupon(coupon)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /coupons/:id - Update coupon (only name and metadata)
    if (req.method === 'PATCH' && couponId) {
      const body: UpdateCouponRequest = await req.json();

      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', couponId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Coupon not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const { data: coupon, error } = await supabase
        .from('coupons')
        .update(updateData)
        .eq('id', couponId)
        .select()
        .single();

      if (error) {
        console.error('[Coupons] Update error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update coupon' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCoupon(coupon)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /coupons/:id - Delete coupon
    if (req.method === 'DELETE' && couponId) {
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', couponId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Coupon not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponId);

      if (error) {
        console.error('[Coupons] Delete error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'delete_failed', message: 'Failed to delete coupon' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ id: couponId, object: 'coupon', deleted: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Coupons] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
