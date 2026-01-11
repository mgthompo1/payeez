import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, generateSecureToken, buildCorsHeaders } from '../_shared/auth.ts';
import {
  getRequestContext,
  authenticationError,
  invalidRequestError,
  apiError,
  createSuccessResponse,
} from '../_shared/responses.ts';

interface Address {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  recipient_name?: string;
}

interface CreateSessionRequest {
  // Core required fields
  amount: number;
  currency: string;

  // Merchant reference (order ID, invoice number)
  merchant_reference?: string;
  external_id?: string;

  // Payment configuration
  payment_method_types?: string[];
  capture_method?: 'automatic' | 'manual';

  // Customer data
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };

  // Addresses for AVS/fraud
  billing_address?: Address;
  shipping_address?: Address;

  // Browser info for 3DS
  browser?: {
    ip_address?: string;
    user_agent?: string;
  };

  // Display/descriptor
  statement_descriptor?: string;
  description?: string;

  // URLs
  success_url?: string;
  cancel_url?: string;

  // Custom data
  metadata?: Record<string, string>;
}

serve(async (req) => {
  const { requestId, corsOrigin, idempotencyKey } = getRequestContext(req);
  const corsHeaders = buildCorsHeaders(corsOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate API key
    const auth = await authenticateApiKey(
      req.headers.get('authorization'),
      supabaseUrl,
      supabaseServiceKey
    );

    if (!auth) {
      return authenticationError(
        'Invalid API key provided',
        'invalid_api_key',
        requestId,
        corsOrigin
      );
    }

    // Parse request body
    const body: CreateSessionRequest = await req.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return invalidRequestError(
        'amount is required and must be a positive integer',
        'parameter_invalid',
        'amount',
        requestId,
        corsOrigin
      );
    }

    if (!body.currency) {
      return invalidRequestError(
        'currency is required',
        'parameter_missing',
        'currency',
        requestId,
        corsOrigin
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing session with idempotency key
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('payment_sessions')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('external_id', idempotencyKey)
        .single();

      if (existing) {
        return createSuccessResponse(
          {
            id: existing.id,
            object: 'payment_session',
            client_secret: existing.client_secret,
            status: existing.status,
            amount: existing.amount,
            currency: existing.currency,
            external_id: existing.external_id,
            fallback_url: existing.fallback_url,
            created_at: existing.created_at,
            livemode: auth.environment === 'live',
          },
          200,
          { requestId, corsOrigin }
        );
      }
    }

    // Generate client secret
    const clientSecret = generateSecureToken('cs_', 48);

    // Create payment session with enhanced fields
    const { data: session, error } = await supabase
      .from('payment_sessions')
      .insert({
        tenant_id: auth.tenantId,
        external_id: body.external_id || idempotencyKey,
        client_secret: clientSecret,
        amount: body.amount,
        currency: body.currency.toUpperCase(),
        status: 'requires_payment_method',
        capture_method: body.capture_method || 'automatic',
        payment_method_types: body.payment_method_types,
        // Merchant reference
        merchant_reference: body.merchant_reference,
        // Customer data
        customer_email: body.customer?.email,
        customer_name: body.customer?.name,
        customer_phone: body.customer?.phone,
        // Addresses
        billing_address: body.billing_address || null,
        shipping_address: body.shipping_address || null,
        // Browser info for 3DS
        browser_ip: body.browser?.ip_address,
        browser_user_agent: body.browser?.user_agent,
        // Display
        statement_descriptor: body.statement_descriptor,
        description: body.description,
        // URLs
        success_url: body.success_url,
        cancel_url: body.cancel_url,
        // Custom data
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return apiError(
        'Failed to create payment session',
        'session_creation_failed',
        requestId,
        corsOrigin
      );
    }

    return createSuccessResponse(
      {
        id: session.id,
        object: 'payment_session',
        client_secret: session.client_secret,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        capture_method: session.capture_method,
        external_id: session.external_id,
        fallback_url: session.fallback_url,
        created_at: session.created_at,
        livemode: auth.environment === 'live',
      },
      201,
      { requestId, corsOrigin }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return apiError(
      'An unexpected error occurred',
      'internal_error',
      requestId,
      corsOrigin
    );
  }
});
