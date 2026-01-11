/**
 * Payment Sessions API
 *
 * Full session lifecycle management (Stripe PaymentIntent-compatible).
 *
 * Routes:
 *   GET    /sessions/:id - Retrieve a session
 *   PATCH  /sessions/:id - Update a session
 *   POST   /sessions/:id/cancel - Cancel a session
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, authenticateClientSecret, buildCorsHeaders } from '../_shared/auth.ts';
import {
  getRequestContext,
  authenticationError,
  invalidRequestError,
  apiError,
  createSuccessResponse,
  createErrorResponse,
} from '../_shared/responses.ts';

// Valid session statuses following Stripe's state machine
type SessionStatus =
  | 'requires_payment_method'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

interface UpdateSessionRequest {
  amount?: number;
  currency?: string;
  description?: string;
  statement_descriptor?: string;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  billing_address?: Record<string, string>;
  shipping_address?: Record<string, string>;
  metadata?: Record<string, string>;
}

interface CancelSessionRequest {
  cancellation_reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'abandoned';
}

interface SessionResponse {
  id: string;
  object: 'payment_session';
  status: SessionStatus;
  amount: number;
  currency: string;
  client_secret: string;
  customer_email: string | null;
  customer_name: string | null;
  description: string | null;
  capture_method: 'automatic' | 'manual';
  payment_method_types: string[] | null;
  billing_address: Record<string, string> | null;
  shipping_address: Record<string, string> | null;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
  cancellation_reason: string | null;
  livemode: boolean;
  // Payment details (after confirmation)
  latest_attempt?: {
    id: string;
    psp: string;
    status: string;
    psp_transaction_id: string | null;
  } | null;
  // Next action (for 3DS/redirects)
  next_action?: {
    type: string;
    redirect_to_url?: {
      url: string;
      return_url: string | null;
    };
  } | null;
}

function formatSession(session: any, livemode: boolean, latestAttempt?: any): SessionResponse {
  return {
    id: session.id,
    object: 'payment_session',
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    client_secret: session.client_secret,
    customer_email: session.customer_email,
    customer_name: session.customer_name,
    description: session.description,
    capture_method: session.capture_method || 'automatic',
    payment_method_types: session.payment_method_types,
    billing_address: session.billing_address,
    shipping_address: session.shipping_address,
    metadata: session.metadata || {},
    created_at: session.created_at,
    updated_at: session.updated_at,
    canceled_at: session.canceled_at,
    cancellation_reason: session.cancellation_reason,
    livemode,
    latest_attempt: latestAttempt ? {
      id: latestAttempt.id,
      psp: latestAttempt.psp,
      status: latestAttempt.status,
      psp_transaction_id: latestAttempt.psp_transaction_id,
    } : null,
    next_action: session.status === 'requires_action' && session.next_action_url ? {
      type: 'redirect',
      redirect_to_url: {
        url: session.next_action_url,
        return_url: session.success_url,
      },
    } : null,
  };
}

// Sessions that can be updated
const UPDATABLE_STATUSES: SessionStatus[] = ['requires_payment_method'];

// Sessions that can be canceled
const CANCELABLE_STATUSES: SessionStatus[] = ['requires_payment_method', 'requires_action', 'processing'];

serve(async (req) => {
  const { requestId, corsOrigin } = getRequestContext(req);
  const corsHeaders = buildCorsHeaders(corsOrigin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const sessionId = pathParts.find(p => p.startsWith('ps_') || p.match(/^[0-9a-f-]{36}$/i)) || pathParts[pathParts.length - 1];
    const isCancel = pathParts[pathParts.length - 1] === 'cancel';

    if (!sessionId || sessionId === 'sessions' || sessionId === 'cancel') {
      return invalidRequestError(
        'Session ID required in URL path',
        'parameter_missing',
        'session_id',
        requestId,
        corsOrigin
      );
    }

    // Authenticate - support both API key and client secret
    let auth: { tenantId: string; session?: any; environment: 'test' | 'live' } | null = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer sk_')) {
      // API key authentication
      const apiAuth = await authenticateApiKey(authHeader, supabaseUrl, supabaseServiceKey);
      if (apiAuth) {
        auth = { tenantId: apiAuth.tenantId, environment: apiAuth.environment };
      }
    } else if (authHeader?.startsWith('Bearer cs_')) {
      // Client secret authentication
      const clientSecret = authHeader.slice(7);
      const clientAuth = await authenticateClientSecret(
        sessionId.replace('cancel', '').replace(/\/$/, ''),
        clientSecret,
        supabaseUrl,
        supabaseServiceKey
      );
      if (clientAuth) {
        auth = { tenantId: clientAuth.tenantId, session: clientAuth.session, environment: 'test' };
        // Get actual environment from tenant
        const { data: tenant } = await supabase
          .from('tenants')
          .select('environment')
          .eq('id', clientAuth.tenantId)
          .single();
        if (tenant?.environment) {
          auth.environment = tenant.environment;
        }
      }
    }

    if (!auth) {
      return authenticationError(
        'Invalid API key or client secret',
        'invalid_authentication',
        requestId,
        corsOrigin
      );
    }

    // Fetch session if not already fetched
    let session = auth.session;
    if (!session) {
      const actualSessionId = isCancel ? pathParts[pathParts.length - 2] : sessionId;
      const { data, error } = await supabase
        .from('payment_sessions')
        .select('*')
        .eq('id', actualSessionId)
        .eq('tenant_id', auth.tenantId)
        .single();

      if (error || !data) {
        return createErrorResponse({
          type: 'invalid_request_error',
          code: 'session_not_found',
          message: `No session found with ID: ${actualSessionId}`,
          requestId,
          corsOrigin,
        });
      }
      session = data;
    }

    // Get latest payment attempt for context
    const { data: latestAttempt } = await supabase
      .from('payment_attempts')
      .select('id, psp, status, psp_transaction_id')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Route: GET /sessions/:id - Retrieve session
    if (req.method === 'GET') {
      return createSuccessResponse(
        formatSession(session, auth.environment === 'live', latestAttempt),
        200,
        { requestId, corsOrigin }
      );
    }

    // Route: PATCH /sessions/:id - Update session
    if (req.method === 'PATCH' && !isCancel) {
      // Check if session can be updated
      if (!UPDATABLE_STATUSES.includes(session.status)) {
        return createErrorResponse({
          type: 'invalid_request_error',
          code: 'session_not_updatable',
          message: `Cannot update session in status: ${session.status}. Only sessions in 'requires_payment_method' status can be updated.`,
          requestId,
          corsOrigin,
        });
      }

      const body: UpdateSessionRequest = await req.json();
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Validate and apply updates
      if (body.amount !== undefined) {
        if (body.amount <= 0) {
          return invalidRequestError(
            'amount must be a positive integer',
            'parameter_invalid',
            'amount',
            requestId,
            corsOrigin
          );
        }
        updates.amount = body.amount;
      }

      if (body.currency !== undefined) {
        updates.currency = body.currency.toUpperCase();
      }

      if (body.description !== undefined) {
        updates.description = body.description;
      }

      if (body.statement_descriptor !== undefined) {
        updates.statement_descriptor = body.statement_descriptor;
      }

      if (body.customer !== undefined) {
        if (body.customer.email !== undefined) updates.customer_email = body.customer.email;
        if (body.customer.name !== undefined) updates.customer_name = body.customer.name;
        if (body.customer.phone !== undefined) updates.customer_phone = body.customer.phone;
      }

      if (body.billing_address !== undefined) {
        updates.billing_address = body.billing_address;
      }

      if (body.shipping_address !== undefined) {
        updates.shipping_address = body.shipping_address;
      }

      if (body.metadata !== undefined) {
        // Merge metadata
        updates.metadata = { ...session.metadata, ...body.metadata };
      }

      const { data: updatedSession, error: updateError } = await supabase
        .from('payment_sessions')
        .update(updates)
        .eq('id', session.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Sessions] Update error:', updateError);
        return apiError(
          'Failed to update session',
          'update_failed',
          requestId,
          corsOrigin
        );
      }

      return createSuccessResponse(
        formatSession(updatedSession, auth.environment === 'live', latestAttempt),
        200,
        { requestId, corsOrigin }
      );
    }

    // Route: POST /sessions/:id/cancel - Cancel session
    if (req.method === 'POST' && isCancel) {
      // Check if session can be canceled
      if (!CANCELABLE_STATUSES.includes(session.status as SessionStatus)) {
        return createErrorResponse({
          type: 'invalid_request_error',
          code: 'session_not_cancelable',
          message: `Cannot cancel session in status: ${session.status}. Only sessions in 'requires_payment_method', 'requires_action', or 'processing' status can be canceled.`,
          requestId,
          corsOrigin,
        });
      }

      let cancellationReason = 'requested_by_customer';
      try {
        const body: CancelSessionRequest = await req.json();
        if (body.cancellation_reason) {
          cancellationReason = body.cancellation_reason;
        }
      } catch {
        // No body or invalid JSON is fine
      }

      const { data: canceledSession, error: cancelError } = await supabase
        .from('payment_sessions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .select()
        .single();

      if (cancelError) {
        console.error('[Sessions] Cancel error:', cancelError);
        return apiError(
          'Failed to cancel session',
          'cancel_failed',
          requestId,
          corsOrigin
        );
      }

      return createSuccessResponse(
        formatSession(canceledSession, auth.environment === 'live', latestAttempt),
        200,
        { requestId, corsOrigin }
      );
    }

    return createErrorResponse({
      type: 'invalid_request_error',
      code: 'method_not_allowed',
      message: `Method ${req.method} not allowed`,
      requestId,
      corsOrigin,
    });

  } catch (err) {
    console.error('[Sessions] Unexpected error:', err);
    return apiError(
      'An unexpected error occurred',
      'internal_error',
      requestId,
      corsOrigin
    );
  }
});
