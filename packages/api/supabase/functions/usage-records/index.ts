/**
 * Usage Records API
 *
 * Record usage for metered billing subscriptions.
 *
 * Routes:
 *   POST /usage-records - Create a usage record
 *   GET  /usage-records - List usage records for a subscription item
 *   GET  /usage-records/summary - Get usage summary for a subscription item
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreateUsageRecordRequest {
  subscription_item: string;
  quantity: number;
  timestamp?: number; // Unix timestamp, defaults to now
  action?: 'increment' | 'set'; // increment adds to existing, set replaces
}

interface UsageRecordResponse {
  id: string;
  object: 'usage_record';
  subscription_item: string;
  quantity: number;
  timestamp: number;
  action: string;
}

interface UsageSummaryResponse {
  object: 'usage_record_summary';
  subscription_item: string;
  period: {
    start: number;
    end: number;
  };
  total_usage: number;
  invoice: string | null;
}

function formatUsageRecord(record: any): UsageRecordResponse {
  return {
    id: record.id,
    object: 'usage_record',
    subscription_item: record.subscription_item_id,
    quantity: record.quantity,
    timestamp: Math.floor(new Date(record.timestamp).getTime() / 1000),
    action: record.action,
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
    const action = pathParts.length > 1 ? pathParts[1] : null;

    // Route: GET /usage-records/summary - Get usage summary
    if (req.method === 'GET' && action === 'summary') {
      const subscriptionItemId = url.searchParams.get('subscription_item');

      if (!subscriptionItemId) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'subscription_item is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription item exists and belongs to tenant
      const { data: item, error: itemError } = await supabase
        .from('subscription_items')
        .select(`
          *,
          prices (
            recurring_usage_type,
            recurring_aggregate_usage
          ),
          subscriptions!inner (
            current_period_start,
            current_period_end,
            customers!inner (tenant_id)
          )
        `)
        .eq('id', subscriptionItemId)
        .single();

      if (itemError || !item) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const periodStart = item.subscriptions.current_period_start;
      const periodEnd = item.subscriptions.current_period_end;
      const aggregateUsage = item.prices?.recurring_aggregate_usage || 'sum';

      // Get usage records for current period
      const { data: records } = await supabase
        .from('usage_records')
        .select('*')
        .eq('subscription_item_id', subscriptionItemId)
        .gte('timestamp', periodStart)
        .lte('timestamp', periodEnd)
        .order('timestamp', { ascending: false });

      // Calculate total based on aggregation method
      let totalUsage = 0;

      if (records && records.length > 0) {
        switch (aggregateUsage) {
          case 'sum':
            totalUsage = records.reduce((sum, r) => sum + r.quantity, 0);
            break;
          case 'max':
            totalUsage = Math.max(...records.map(r => r.quantity));
            break;
          case 'last_during_period':
            totalUsage = records[0].quantity; // Already sorted descending by timestamp
            break;
          case 'last_ever':
            // Get the latest record ever, not just in period
            const { data: latestRecord } = await supabase
              .from('usage_records')
              .select('quantity')
              .eq('subscription_item_id', subscriptionItemId)
              .order('timestamp', { ascending: false })
              .limit(1)
              .single();
            totalUsage = latestRecord?.quantity || 0;
            break;
        }
      }

      const summary: UsageSummaryResponse = {
        object: 'usage_record_summary',
        subscription_item: subscriptionItemId,
        period: {
          start: Math.floor(new Date(periodStart).getTime() / 1000),
          end: Math.floor(new Date(periodEnd).getTime() / 1000),
        },
        total_usage: totalUsage,
        invoice: null, // Would be linked to invoice when billed
      };

      return new Response(
        JSON.stringify(summary),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /usage-records - Create usage record
    if (req.method === 'POST') {
      const body: CreateUsageRecordRequest = await req.json();

      if (!body.subscription_item) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'subscription_item is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.quantity === undefined || body.quantity < 0) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'quantity must be a non-negative number' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription item exists, is metered, and belongs to tenant
      const { data: item, error: itemError } = await supabase
        .from('subscription_items')
        .select(`
          *,
          prices (
            recurring_usage_type
          ),
          subscriptions!inner (
            status,
            customers!inner (tenant_id)
          )
        `)
        .eq('id', body.subscription_item)
        .single();

      if (itemError || !item) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (item.prices?.recurring_usage_type !== 'metered') {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_request', message: 'Usage records can only be created for metered prices' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['active', 'trialing'].includes(item.subscriptions?.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Cannot report usage for inactive subscription' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timestamp = body.timestamp ? new Date(body.timestamp * 1000) : new Date();
      const recordAction = body.action || 'increment';

      // Create usage record
      const { data: record, error: recordError } = await supabase
        .from('usage_records')
        .insert({
          subscription_item_id: body.subscription_item,
          quantity: body.quantity,
          timestamp: timestamp.toISOString(),
          action: recordAction,
        })
        .select()
        .single();

      if (recordError) {
        console.error('[UsageRecords] Create error:', recordError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create usage record' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatUsageRecord(record)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /usage-records - List usage records
    if (req.method === 'GET') {
      const subscriptionItemId = url.searchParams.get('subscription_item');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (!subscriptionItemId) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'subscription_item is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify subscription item belongs to tenant
      const { data: item } = await supabase
        .from('subscription_items')
        .select('subscriptions!inner(customers!inner(tenant_id))')
        .eq('id', subscriptionItemId)
        .single();

      if (!item || item.subscriptions?.customers?.tenant_id !== auth.tenantId) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Subscription item not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: records, error, count } = await supabase
        .from('usage_records')
        .select('*', { count: 'exact' })
        .eq('subscription_item_id', subscriptionItemId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[UsageRecords] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list usage records' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (records || []).map(formatUsageRecord),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[UsageRecords] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
