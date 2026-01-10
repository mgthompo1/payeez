/**
 * Customers API
 *
 * CRUD operations for customer management.
 * Customers are the billing entities for subscriptions and invoices.
 *
 * Routes:
 *   POST   /customers              - Create a customer
 *   GET    /customers              - List customers
 *   GET    /customers/:id          - Get a customer
 *   PATCH  /customers/:id          - Update a customer
 *   DELETE /customers/:id          - Delete a customer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, buildCorsHeaders } from '../_shared/auth.ts';

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface CreateCustomerRequest {
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  billing_address?: Address;
  shipping_address?: Address;
  tax_exempt?: boolean;
  tax_ids?: Array<{ type: string; value: string }>;
  metadata?: Record<string, string>;
}

interface UpdateCustomerRequest {
  email?: string;
  name?: string;
  phone?: string;
  description?: string;
  billing_address?: Address;
  shipping_address?: Address;
  default_token_id?: string;
  tax_exempt?: boolean;
  tax_ids?: Array<{ type: string; value: string }>;
  metadata?: Record<string, string>;
}

interface CustomerResponse {
  id: string;
  object: 'customer';
  email: string;
  name: string | null;
  phone: string | null;
  description: string | null;
  billing_address: Address | null;
  shipping_address: Address | null;
  default_payment_method: string | null;
  tax_exempt: boolean;
  tax_ids: Array<{ type: string; value: string }>;
  metadata: Record<string, string>;
  created: number;
}

function formatCustomer(customer: any): CustomerResponse {
  return {
    id: customer.id,
    object: 'customer',
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    description: customer.description,
    billing_address: customer.billing_address,
    shipping_address: customer.shipping_address,
    default_payment_method: customer.default_token_id,
    tax_exempt: customer.tax_exempt || false,
    tax_ids: customer.tax_ids || [],
    metadata: customer.metadata || {},
    created: Math.floor(new Date(customer.created_at).getTime() / 1000),
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

    // Extract customer ID from path if present
    // Path: /customers or /customers/:id
    const customerId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // Route: POST /customers - Create customer
    if (req.method === 'POST' && !customerId) {
      const body: CreateCustomerRequest = await req.json();

      // Validate required fields
      if (!body.email) {
        return new Response(
          JSON.stringify({ error: { code: 'validation_error', message: 'email is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing customer with same email
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('email', body.email)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'customer_exists',
              message: 'A customer with this email already exists',
              existing_customer_id: existing.id,
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create customer
      const { data: customer, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: auth.tenantId,
          email: body.email,
          name: body.name,
          phone: body.phone,
          description: body.description,
          billing_address: body.billing_address || null,
          shipping_address: body.shipping_address || null,
          tax_exempt: body.tax_exempt || false,
          tax_ids: body.tax_ids || [],
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Customers] Create error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'create_failed', message: 'Failed to create customer' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCustomer(customer)),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /customers - List customers
    if (req.method === 'GET' && !customerId) {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const email = url.searchParams.get('email');

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (email) {
        query = query.eq('email', email);
      }

      const { data: customers, error, count } = await query;

      if (error) {
        console.error('[Customers] List error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'list_failed', message: 'Failed to list customers' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          object: 'list',
          data: (customers || []).map(formatCustomer),
          has_more: (offset + limit) < (count || 0),
          total_count: count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /customers/:id - Get customer
    if (req.method === 'GET' && customerId) {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('id', customerId)
        .single();

      if (error || !customer) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCustomer(customer)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: PATCH /customers/:id - Update customer
    if (req.method === 'PATCH' && customerId) {
      const body: UpdateCustomerRequest = await req.json();

      // Check customer exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', customerId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If updating email, check for conflicts
      if (body.email) {
        const { data: emailConflict } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', auth.tenantId)
          .eq('email', body.email)
          .neq('id', customerId)
          .single();

        if (emailConflict) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'email_exists',
                message: 'A customer with this email already exists',
              },
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (body.email !== undefined) updateData.email = body.email;
      if (body.name !== undefined) updateData.name = body.name;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.billing_address !== undefined) updateData.billing_address = body.billing_address;
      if (body.shipping_address !== undefined) updateData.shipping_address = body.shipping_address;
      if (body.default_token_id !== undefined) updateData.default_token_id = body.default_token_id;
      if (body.tax_exempt !== undefined) updateData.tax_exempt = body.tax_exempt;
      if (body.tax_ids !== undefined) updateData.tax_ids = body.tax_ids;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;

      const { data: customer, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select()
        .single();

      if (error) {
        console.error('[Customers] Update error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'update_failed', message: 'Failed to update customer' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(formatCustomer(customer)),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: DELETE /customers/:id - Delete customer
    if (req.method === 'DELETE' && customerId) {
      // Check customer exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('id', customerId)
        .single();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: 'Customer not found' } }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for active subscriptions
      const { data: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('customer_id', customerId)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1);

      if (activeSubscriptions && activeSubscriptions.length > 0) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'has_active_subscriptions',
              message: 'Cannot delete customer with active subscriptions',
            },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) {
        console.error('[Customers] Delete error:', error);
        return new Response(
          JSON.stringify({ error: { code: 'delete_failed', message: 'Failed to delete customer' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ id: customerId, object: 'customer', deleted: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: { code: 'method_not_allowed', message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Customers] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
