/**
 * Webhook Handler Edge Function
 *
 * Receives webhooks from PSPs, normalizes them, and forwards to merchant endpoints.
 *
 * Routes:
 * - POST /webhooks/stripe - Stripe webhooks
 * - POST /webhooks/adyen - Adyen webhooks
 * - POST /webhooks/:psp - Other PSP webhooks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { buildCorsHeaders } from '../_shared/auth.ts'

// Webhook-specific allowed headers (includes PSP signature headers)
function getWebhookCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const baseHeaders = buildCorsHeaders(requestOrigin);
  // Webhooks come from PSP servers, not browsers - but we still want proper CORS for any browser-based testing
  return {
    ...baseHeaders,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-adyen-hmac-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface NormalizedWebhookEvent {
  type: string
  psp: string
  psp_event_id: string
  transaction_id?: string
  session_id?: string
  amount?: number
  currency?: string
  timestamp: string
  raw_payload: Record<string, unknown>
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1]

  if (!timestamp || !sig) return false

  // Check timestamp is within tolerance (5 minutes)
  const timestampAge = Date.now() / 1000 - parseInt(timestamp)
  if (timestampAge > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const expectedSig = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

/**
 * Verify Adyen webhook signature using timing-safe comparison
 * Prevents timing attacks by ensuring constant-time comparison
 */
function verifyAdyenSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expectedSig = createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(payload)
      .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    // Buffers must be same length for timingSafeEqual
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    console.error('[Security] Adyen signature verification error:', error);
    return false;
  }
}

/**
 * Normalize Stripe webhook event
 */
function normalizeStripeEvent(payload: Record<string, unknown>): NormalizedWebhookEvent {
  const event = payload
  const object = (event.data as Record<string, unknown>)?.object as Record<string, unknown> || {}

  const eventTypeMap: Record<string, string> = {
    'payment_intent.succeeded': 'payment.captured',
    'payment_intent.payment_failed': 'payment.failed',
    'payment_intent.canceled': 'payment.canceled',
    'payment_intent.requires_capture': 'payment.authorized',
    'charge.refunded': 'refund.succeeded',
    'charge.refund.updated': 'refund.updated',
    'charge.dispute.created': 'dispute.created',
    'charge.dispute.closed': 'dispute.resolved',
  }

  return {
    type: eventTypeMap[event.type as string] || (event.type as string),
    psp: 'stripe',
    psp_event_id: event.id as string,
    transaction_id: (object.id || object.payment_intent) as string,
    amount: object.amount as number,
    currency: (object.currency as string)?.toUpperCase(),
    timestamp: new Date((event.created as number) * 1000).toISOString(),
    raw_payload: payload,
  }
}

/**
 * Normalize Adyen webhook event
 */
function normalizeAdyenEvent(payload: Record<string, unknown>): NormalizedWebhookEvent {
  const items = (payload.notificationItems as Array<Record<string, unknown>>) || []
  const item = (items[0]?.NotificationRequestItem || payload) as Record<string, unknown>

  const eventTypeMap: Record<string, string> = {
    'AUTHORISATION': (item.success === 'true' || item.success === true) ? 'payment.authorized' : 'payment.failed',
    'CAPTURE': 'payment.captured',
    'CANCELLATION': 'payment.canceled',
    'REFUND': 'refund.succeeded',
    'REFUND_FAILED': 'refund.failed',
    'CHARGEBACK': 'dispute.created',
    'CHARGEBACK_REVERSED': 'dispute.resolved',
  }

  const amount = item.amount as Record<string, unknown>

  return {
    type: eventTypeMap[item.eventCode as string] || (item.eventCode as string),
    psp: 'adyen',
    psp_event_id: item.pspReference as string,
    transaction_id: item.pspReference as string,
    amount: amount?.value as number,
    currency: amount?.currency as string,
    timestamp: item.eventDate as string || new Date().toISOString(),
    raw_payload: payload,
  }
}

/**
 * Forward webhook to merchant endpoint
 */
async function forwardToMerchant(
  webhookUrl: string,
  webhookSecret: string | null | undefined,
  event: NormalizedWebhookEvent
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Payeez-Event-Type': event.type,
    'X-Payeez-Event-Id': event.psp_event_id,
    'X-Payeez-Timestamp': `${timestamp}`,
  }

  if (webhookSecret) {
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    headers['X-Payeez-Signature'] = `t=${timestamp},v1=${signature}`
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    return {
      success: response.ok,
      statusCode: response.status,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getWebhookCorsHeaders(requestOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const psp = pathParts[pathParts.length - 1] || 'unknown'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    // Get webhook secrets from environment or database
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const adyenWebhookSecret = Deno.env.get('ADYEN_WEBHOOK_SECRET')

    // Verify signature based on PSP
    let signatureValid = false
    let normalizedEvent: NormalizedWebhookEvent

    // SECURITY: Default to enforcing signatures in production
    // Set PAYEEZ_ENFORCE_WEBHOOK_SIGNATURES=false only for local development
    const enforceSignatures = Deno.env.get('PAYEEZ_ENFORCE_WEBHOOK_SIGNATURES') !== 'false'

    switch (psp) {
      case 'stripe':
        const stripeSignature = req.headers.get('stripe-signature')
        if (stripeSignature && stripeWebhookSecret) {
          signatureValid = verifyStripeSignature(rawBody, stripeSignature, stripeWebhookSecret)
        }
        normalizedEvent = normalizeStripeEvent(payload)
        if (enforceSignatures && !signatureValid) {
          return new Response(
            JSON.stringify({ error: 'Invalid webhook signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break

      case 'adyen':
        const adyenSignature = req.headers.get('x-adyen-hmac-signature')
        if (adyenSignature && adyenWebhookSecret) {
          signatureValid = verifyAdyenSignature(rawBody, adyenSignature, adyenWebhookSecret)
        }
        normalizedEvent = normalizeAdyenEvent(payload)
        if (enforceSignatures && !signatureValid) {
          return new Response(
            JSON.stringify({ error: 'Invalid webhook signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Adyen expects [accepted] response
        break

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported PSP: ${psp}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Log signature verification result for monitoring
    if (!signatureValid && !enforceSignatures) {
      console.warn(`[Security] Webhook signature verification failed for ${psp} (enforcement disabled)`);
    }

    // Find the session/tenant from the transaction ID
    let tenantId: string | null = null
    let sessionId: string | null = null

    if (normalizedEvent.transaction_id) {
      // Look up the payment attempt by PSP transaction ID
      const { data: attempt } = await supabase
        .from('payment_attempts')
        .select('session_id, tenant_id')
        .eq('psp_transaction_id', normalizedEvent.transaction_id)
        .single()

      if (attempt) {
        tenantId = attempt.tenant_id
        sessionId = attempt.session_id
        normalizedEvent.session_id = sessionId
      }
    }

    // Store the webhook event
    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        event_type: normalizedEvent.type,
        psp: normalizedEvent.psp,
        psp_event_id: normalizedEvent.psp_event_id,
        payload: normalizedEvent.raw_payload,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing webhook event:', insertError)
    }

    // Update session status based on event type
    if (sessionId) {
      let newStatus: string | null = null

      switch (normalizedEvent.type) {
        case 'payment.captured':
          newStatus = 'succeeded'
          break
        case 'payment.failed':
          newStatus = 'failed'
          break
        case 'payment.canceled':
          newStatus = 'canceled'
          break
        case 'payment.authorized':
          newStatus = 'processing'
          break
        case 'refund.succeeded':
          newStatus = 'refunded'
          break
      }

      if (newStatus) {
        await supabase
          .from('payment_sessions')
          .update({ status: newStatus })
          .eq('id', sessionId)
      }
    }

    // Forward to merchant webhook endpoints
    if (tenantId) {
      const { data: merchantWebhooks } = await supabase
        .from('merchant_webhooks')
        .select('id, url, events')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      if (merchantWebhooks && merchantWebhooks.length > 0) {
        // Get tenant's webhook secret
        const { data: tenant } = await supabase
          .from('tenants')
          .select('webhook_secret')
          .eq('id', tenantId)
          .single()

        const webhookSecret = tenant?.webhook_secret

        for (const webhook of merchantWebhooks) {
          // Check if this webhook is subscribed to this event type
          if (webhook.events && !webhook.events.includes(normalizedEvent.type)) {
            continue
          }

          // Forward the webhook
          const result = await forwardToMerchant(webhook.url, webhookSecret, normalizedEvent)

          // Record delivery attempt
          await supabase.from('webhook_deliveries').insert({
            webhook_id: webhook.id,
            event_type: normalizedEvent.type,
            payload: normalizedEvent,
            response_status: result.statusCode,
            response_body: result.error,
            delivered_at: result.success ? new Date().toISOString() : null,
            attempts: 1,
            next_retry_at: result.success ? null : new Date(Date.now() + 60000).toISOString(),
          })
        }
      }
    }

    // Mark webhook event as processed
    if (webhookEvent?.id) {
      await supabase
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', webhookEvent.id)
    }

    // Return appropriate response for each PSP
    if (psp === 'adyen') {
      // Adyen expects [accepted] response
      return new Response('[accepted]', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    return new Response(
      JSON.stringify({ received: true, event_id: webhookEvent?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
