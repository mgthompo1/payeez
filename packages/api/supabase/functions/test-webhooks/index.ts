/**
 * Test Webhook Simulator Endpoint
 *
 * Allows triggering simulated webhook events in test mode
 * Useful for testing webhook handlers without making real payments
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'
import { authenticateApiKey, corsHeaders, errorResponse, successResponse } from '../_shared/auth.ts'

interface SimulateWebhookRequest {
  event_type: string
  session_id?: string
  transaction_id?: string
  amount?: number
  currency?: string
  metadata?: Record<string, unknown>
  delay_seconds?: number
}

const VALID_EVENT_TYPES = [
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'payment.canceled',
  'payment.requires_action',
  'refund.succeeded',
  'refund.failed',
  'refund.pending',
  'dispute.created',
  'dispute.updated',
  'dispute.resolved',
  'dispute.lost',
]

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is allowed', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Authenticate API key
    const auth = await authenticateApiKey(
      req.headers.get('authorization'),
      supabaseUrl,
      supabaseServiceKey
    )

    if (!auth) {
      return errorResponse('unauthorized', 'Invalid or missing API key', 401)
    }

    // Only allow in test mode
    if (auth.environment !== 'test') {
      return errorResponse(
        'test_mode_only',
        'This endpoint is only available in test mode. Use a test API key (sk_test_*).',
        403
      )
    }

    const body: SimulateWebhookRequest = await req.json()

    // Validate event type
    if (!body.event_type || !VALID_EVENT_TYPES.includes(body.event_type)) {
      return errorResponse(
        'invalid_event_type',
        `Invalid event_type. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
        400
      )
    }

    // Generate test IDs if not provided
    const transactionId = body.transaction_id || `pi_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const eventId = `evt_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

    // Build the simulated webhook event
    const webhookEvent = {
      id: eventId,
      type: body.event_type,
      psp: 'test',
      psp_event_id: eventId,
      transaction_id: transactionId,
      session_id: body.session_id,
      amount: body.amount || 1000,
      currency: body.currency || 'USD',
      timestamp: new Date().toISOString(),
      raw_payload: {
        id: eventId,
        type: body.event_type,
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: transactionId,
            amount: body.amount || 1000,
            currency: (body.currency || 'usd').toLowerCase(),
            status: mapEventTypeToStatus(body.event_type),
            metadata: body.metadata || {},
          },
        },
      },
    }

    // If session_id is provided, look it up and get tenant info
    let tenantId = auth.tenantId
    let sessionId = body.session_id

    if (sessionId) {
      const { data: session } = await supabase
        .from('payment_sessions')
        .select('tenant_id, status')
        .eq('id', sessionId)
        .eq('tenant_id', tenantId)
        .single()

      if (!session) {
        return errorResponse('session_not_found', 'Session not found', 404)
      }

      tenantId = session.tenant_id
    }

    // Store the webhook event
    const { data: storedEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        event_type: body.event_type,
        psp: 'test',
        psp_event_id: eventId,
        payload: webhookEvent.raw_payload,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing webhook event:', insertError)
    }

    // Update session status if applicable
    if (sessionId) {
      const newStatus = mapEventTypeToSessionStatus(body.event_type)
      if (newStatus) {
        await supabase
          .from('payment_sessions')
          .update({ status: newStatus })
          .eq('id', sessionId)
      }
    }

    // Forward to merchant webhook endpoints (optionally with delay)
    const deliveryPromise = deliverToMerchantWebhooks(
      supabase,
      tenantId,
      webhookEvent,
      body.delay_seconds
    )

    // Don't wait for delivery if delay is specified
    if (body.delay_seconds && body.delay_seconds > 0) {
      // Fire and forget
      deliveryPromise.catch(err => console.error('Webhook delivery error:', err))

      return successResponse({
        success: true,
        event_id: eventId,
        transaction_id: transactionId,
        message: `Webhook will be delivered after ${body.delay_seconds} seconds`,
        event: webhookEvent,
      })
    }

    // Wait for delivery
    const deliveryResults = await deliveryPromise

    return successResponse({
      success: true,
      event_id: eventId,
      transaction_id: transactionId,
      event: webhookEvent,
      deliveries: deliveryResults,
    })
  } catch (error) {
    console.error('Test webhook error:', error)
    return errorResponse('server_error', 'Internal server error', 500)
  }
})

function mapEventTypeToStatus(eventType: string): string {
  const mapping: Record<string, string> = {
    'payment.authorized': 'requires_capture',
    'payment.captured': 'succeeded',
    'payment.failed': 'failed',
    'payment.canceled': 'canceled',
    'payment.requires_action': 'requires_action',
    'refund.succeeded': 'succeeded',
    'refund.failed': 'failed',
    'refund.pending': 'pending',
    'dispute.created': 'warning_needs_response',
    'dispute.updated': 'warning_needs_response',
    'dispute.resolved': 'won',
    'dispute.lost': 'lost',
  }
  return mapping[eventType] || 'unknown'
}

function mapEventTypeToSessionStatus(eventType: string): string | null {
  const mapping: Record<string, string> = {
    'payment.authorized': 'processing',
    'payment.captured': 'succeeded',
    'payment.failed': 'failed',
    'payment.canceled': 'canceled',
    'refund.succeeded': 'refunded',
  }
  return mapping[eventType] || null
}

async function deliverToMerchantWebhooks(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  event: Record<string, unknown>,
  delaySeconds?: number
): Promise<Array<{ url: string; success: boolean; status?: number; error?: string }>> {
  if (delaySeconds && delaySeconds > 0) {
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
  }

  // Get merchant webhook endpoints
  const { data: webhooks } = await supabase
    .from('merchant_webhooks')
    .select('id, url, events')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!webhooks || webhooks.length === 0) {
    return []
  }

  // Get tenant webhook secret
  const { data: tenant } = await supabase
    .from('tenants')
    .select('webhook_secret')
    .eq('id', tenantId)
    .single()

  const webhookSecret = tenant?.webhook_secret || 'test_webhook_secret'

  const results: Array<{ url: string; success: boolean; status?: number; error?: string }> = []

  for (const webhook of webhooks) {
    // Check if webhook is subscribed to this event type
    if (webhook.events && !webhook.events.includes(event.type as string)) {
      continue
    }

    const payload = JSON.stringify(event)
    const timestamp = Math.floor(Date.now() / 1000)

    // Generate signature
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Signature': `t=${timestamp},v1=${signature}`,
          'X-Atlas-Event-Type': event.type as string,
          'X-Atlas-Event-Id': event.id as string,
          'X-Atlas-Test-Mode': 'true',
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      })

      results.push({
        url: webhook.url,
        success: response.ok,
        status: response.status,
      })

      // Record delivery
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event_type: event.type,
        payload: event,
        response_status: response.status,
        delivered_at: response.ok ? new Date().toISOString() : null,
        attempts: 1,
      })
    } catch (error) {
      results.push({
        url: webhook.url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}
