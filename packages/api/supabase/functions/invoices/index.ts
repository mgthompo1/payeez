/**
 * Invoices API
 *
 * CRUD operations for invoice management.
 * Invoices represent billing records for subscriptions.
 *
 * Routes:
 *   POST   /invoices                    - Create a draft invoice
 *   GET    /invoices                    - List invoices
 *   GET    /invoices/:id                - Get an invoice
 *   POST   /invoices/:id/finalize       - Finalize a draft invoice
 *   POST   /invoices/:id/pay            - Attempt to pay an invoice
 *   POST   /invoices/:id/void           - Void an invoice
 *   POST   /invoices/:id/mark-uncollectible - Mark as uncollectible
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface CreateInvoiceRequest {
  customer: string;
  subscription?: string;
  collection_method?: 'charge_automatically' | 'send_invoice';
  days_until_due?: number;
  description?: string;
  metadata?: Record<string, string>;
  auto_advance?: boolean;
}

interface InvoiceLineItemResponse {
  id: string;
  object: 'line_item';
  amount: number;
  currency: string;
  description: string | null;
  price: {
    id: string;
    product: string;
  } | null;
  quantity: number;
  period: {
    start: number;
    end: number;
  } | null;
}

interface InvoiceResponse {
  id: string;
  object: 'invoice';
  number: string | null;
  customer: string;
  subscription: string | null;
  status: string;
  collection_method: string;
  currency: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  subtotal: number;
  tax: number;
  total: number;
  description: string | null;
  due_date: number | null;
  period_start: number | null;
  period_end: number | null;
  lines: {
    object: 'list';
    data: InvoiceLineItemResponse[];
  };
  paid: boolean;
  paid_at: number | null;
  voided_at: number | null;
  hosted_invoice_url: string | null;
  metadata: Record<string, string>;
  created: number;
}

function formatLineItem(item: any): InvoiceLineItemResponse {
  return {
    id: item.id,
    object: 'line_item',
    amount: item.amount,
    currency: item.currency,
    description: item.description,
    price: item.price_id ? {
      id: item.price_id,
      product: item.prices?.product_id || null,
    } : null,
    quantity: item.quantity,
    period: item.period_start ? {
      start: Math.floor(new Date(item.period_start).getTime() / 1000),
      end: Math.floor(new Date(item.period_end).getTime() / 1000),
    } : null,
  };
}

function formatInvoice(invoice: any, lineItems: any[]): InvoiceResponse {
  const amountPaid = invoice.status === 'paid' ? invoice.total : 0;
  const amountRemaining = invoice.total - amountPaid;

  return {
    id: invoice.id,
    object: 'invoice',
    number: invoice.invoice_number,
    customer: invoice.customer_id,
    subscription: invoice.subscription_id,
    status: invoice.status,
    collection_method: invoice.collection_method,
    currency: invoice.currency,
    amount_due: invoice.total,
    amount_paid: amountPaid,
    amount_remaining: amountRemaining,
    subtotal: invoice.subtotal,
    tax: invoice.tax || 0,
    total: invoice.total,
    description: invoice.description,
    due_date: invoice.due_date ? Math.floor(new Date(invoice.due_date).getTime() / 1000) : null,
    period_start: invoice.period_start ? Math.floor(new Date(invoice.period_start).getTime() / 1000) : null,
    period_end: invoice.period_end ? Math.floor(new Date(invoice.period_end).getTime() / 1000) : null,
    lines: {
      object: 'list',
      data: lineItems.map(formatLineItem),
    },
    paid: invoice.status === 'paid',
    paid_at: invoice.paid_at ? Math.floor(new Date(invoice.paid_at).getTime() / 1000) : null,
    voided_at: invoice.voided_at ? Math.floor(new Date(invoice.voided_at).getTime() / 1000) : null,
    hosted_invoice_url: invoice.hosted_invoice_url,
    metadata: invoice.metadata || {},
    created: Math.floor(new Date(invoice.created_at).getTime() / 1000),
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

    // Extract invoice ID and action from path
    const invoiceId = pathParts.length > 1 ? pathParts[1] : null;
    const action = pathParts.length > 2 ? pathParts[2] : null;

    // Route: POST /invoices/:id/finalize - Finalize draft invoice
    if (req.method === 'POST' && invoiceId && action === 'finalize') {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id)')
        .eq('id', invoiceId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !invoice) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Invoice not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invoice.status !== 'draft') {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Only draft invoices can be finalized' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'open',
          finalized_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'finalize_failed', message: 'Failed to finalize invoice' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .eq('invoice_id', invoiceId);

      return new Response(
        JSON.stringify(formatInvoice(updated, lineItems || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /invoices/:id/pay - Pay invoice
    if (req.method === 'POST' && invoiceId && action === 'pay') {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id, default_token_id)')
        .eq('id', invoiceId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !invoice) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Invoice not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['open', 'past_due'].includes(invoice.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Invoice cannot be paid in current state' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // In a real implementation, this would call the payment orchestrator
      // For now, we'll just mark it as paid
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'payment_failed', message: 'Failed to process payment' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .eq('invoice_id', invoiceId);

      return new Response(
        JSON.stringify(formatInvoice(updated, lineItems || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /invoices/:id/void - Void invoice
    if (req.method === 'POST' && invoiceId && action === 'void') {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id)')
        .eq('id', invoiceId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !invoice) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Invoice not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['draft', 'open'].includes(invoice.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Only draft or open invoices can be voided' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'void',
          voided_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'void_failed', message: 'Failed to void invoice' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .eq('invoice_id', invoiceId);

      return new Response(
        JSON.stringify(formatInvoice(updated, lineItems || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /invoices/:id/mark-uncollectible - Mark as uncollectible
    if (req.method === 'POST' && invoiceId && action === 'mark-uncollectible') {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id)')
        .eq('id', invoiceId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (fetchError || !invoice) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Invoice not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['open', 'past_due'].includes(invoice.status)) {
        return new Response(
          JSON.stringify({ error: { code: 'invalid_state', message: 'Only open or past_due invoices can be marked uncollectible' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('invoices')
        .update({ status: 'uncollectible' })
        .eq('id', invoiceId);

      if (error) {
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to mark invoice as uncollectible' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .eq('invoice_id', invoiceId);

      return new Response(
        JSON.stringify(formatInvoice(updated, lineItems || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /invoices - Create draft invoice
    if (req.method === 'POST' && !invoiceId) {
      const body: CreateInvoiceRequest = await req.json();

      // Validate required fields
      if (!body.customer) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'customer is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify customer exists and belongs to tenant
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, tenant_id')
        .eq('id', body.customer)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If subscription provided, verify it
      let subscription = null;
      if (body.subscription) {
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', body.subscription)
          .eq('customer_id', body.customer)
          .single();

        if (subError || !sub) {
          return new Response(
            JSON.stringify({ error: { code: 'not_found', message: 'Subscription not found' } }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        subscription = sub;
      }

      // Calculate due date
      let dueDate = null;
      if (body.collection_method === 'send_invoice' || body.days_until_due) {
        const days = body.days_until_due || 30;
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: auth.tenantId,
          customer_id: body.customer,
          subscription_id: body.subscription || null,
          status: 'draft',
          collection_method: body.collection_method || 'charge_automatically',
          currency: 'usd', // Default, should come from subscription or tenant settings
          subtotal: 0,
          tax: 0,
          total: 0,
          due_date: dueDate?.toISOString() || null,
          period_start: subscription?.current_period_start || null,
          period_end: subscription?.current_period_end || null,
          description: body.description || null,
          auto_advance: body.auto_advance !== false,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('[Invoices] Create error:', invoiceError);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create invoice' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatInvoice(invoice, [])),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /invoices - List invoices
    if (req.method === 'GET' && !invoiceId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const customerId = url.searchParams.get('customer');
      const subscriptionId = url.searchParams.get('subscription');
      const status = url.searchParams.get('status');

      let query = supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id)', { count: 'exact' })
        .eq('customers.tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (subscriptionId) {
        query = query.eq('subscription_id', subscriptionId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data: invoices, error, count } = await query;

      if (error) {
        console.error('[Invoices] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list invoices' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch line items for all invoices
      const invoiceIds = (invoices || []).map((i: any) => i.id);
      const { data: allLineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .in('invoice_id', invoiceIds);

      // Group line items by invoice
      const lineItemsByInvoice: Record<string, any[]> = {};
      (allLineItems || []).forEach((item: any) => {
        if (!lineItemsByInvoice[item.invoice_id]) {
          lineItemsByInvoice[item.invoice_id] = [];
        }
        lineItemsByInvoice[item.invoice_id].push(item);
      });

      const formattedInvoices = (invoices || []).map((inv: any) =>
        formatInvoice(inv, lineItemsByInvoice[inv.id] || [])
      );

      return new Response(
        JSON.stringify({
          object: 'list',
          data: formattedInvoices,
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /invoices/:id - Get invoice
    if (req.method === 'GET' && invoiceId && !action) {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, customers!inner(tenant_id)')
        .eq('id', invoiceId)
        .eq('customers.tenant_id', auth.tenantId)
        .single();

      if (error || !invoice) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Invoice not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*, prices(product_id)')
        .eq('invoice_id', invoiceId);

      return new Response(
        JSON.stringify(formatInvoice(invoice, lineItems || [])),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Invoices] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
