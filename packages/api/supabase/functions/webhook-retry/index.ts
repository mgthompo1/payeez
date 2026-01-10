/**
 * Webhook Retry Worker Edge Function
 *
 * Processes failed webhook deliveries and retries them with exponential backoff.
 * Can be triggered by a cron job or manually via HTTP.
 *
 * Routes:
 * - POST /webhook-retry - Process pending retries
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

import { buildCorsHeaders, verifyApiKey } from '../_shared/auth.ts'

const MAX_RETRIES = 5
const BACKOFF_MULTIPLIER = 2
const BASE_DELAY_MS = 60000 // 1 minute

interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
  next_retry_at: string | null
}

interface MerchantWebhook {
  id: string
  url: string
  tenant_id: string
}

/**
 * Calculate next retry time using exponential backoff
 */
function calculateNextRetry(attempts: number): Date {
  const delayMs = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempts)
  return new Date(Date.now() + delayMs)
}

/**
 * Deliver webhook to merchant endpoint
 */
async function deliverWebhook(
  url: string,
  webhookSecret: string | null,
  payload: Record<string, unknown>,
  eventType: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadString = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const deliveryId = `del_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Atlas-Event': eventType,
    'X-Atlas-Delivery': deliveryId,
    'X-Atlas-Timestamp': `${timestamp}`,
  }

  if (webhookSecret) {
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payloadString}`)
      .digest('hex')
    headers['X-Atlas-Signature'] = `t=${timestamp},v1=${signature}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString,
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
  const requestOrigin = req.headers.get('origin')
  const corsHeaders = buildCorsHeaders(requestOrigin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Allow cron triggers without auth (they have internal Supabase auth)
  // but verify API key for manual triggers
  const isCronTrigger = req.headers.get('x-supabase-cron') === 'true'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  if (!isCronTrigger) {
    const authResult = await verifyApiKey(req, supabase)
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  try {
    // Find pending webhook deliveries that need retrying
    const now = new Date().toISOString()
    const { data: pendingDeliveries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        id,
        webhook_id,
        event_type,
        payload,
        attempts,
        next_retry_at
      `)
      .is('delivered_at', null)
      .lt('attempts', MAX_RETRIES)
      .lt('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      throw new Error(`Failed to fetch pending deliveries: ${fetchError.message}`)
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending deliveries' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      exhausted: 0,
    }

    // Process each delivery
    for (const delivery of pendingDeliveries as WebhookDelivery[]) {
      results.processed++

      // Get webhook endpoint details
      const { data: webhook } = await supabase
        .from('merchant_webhooks')
        .select('id, url, tenant_id')
        .eq('id', delivery.webhook_id)
        .eq('is_active', true)
        .single()

      if (!webhook) {
        // Webhook endpoint no longer exists or is disabled
        await supabase
          .from('webhook_deliveries')
          .update({
            response_body: 'Webhook endpoint not found or disabled',
            next_retry_at: null, // Stop retrying
          })
          .eq('id', delivery.id)
        results.failed++
        continue
      }

      // Get tenant's webhook secret
      const { data: tenant } = await supabase
        .from('tenants')
        .select('webhook_secret')
        .eq('id', (webhook as MerchantWebhook).tenant_id)
        .single()

      const webhookSecret = tenant?.webhook_secret

      // Attempt delivery
      const result = await deliverWebhook(
        (webhook as MerchantWebhook).url,
        webhookSecret,
        delivery.payload,
        delivery.event_type
      )

      const newAttempts = delivery.attempts + 1

      if (result.success) {
        // Success - mark as delivered
        await supabase
          .from('webhook_deliveries')
          .update({
            delivered_at: new Date().toISOString(),
            response_status: result.statusCode,
            attempts: newAttempts,
            next_retry_at: null,
          })
          .eq('id', delivery.id)
        results.succeeded++
      } else if (newAttempts >= MAX_RETRIES) {
        // Max retries reached
        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: result.statusCode,
            response_body: result.error || `Failed after ${MAX_RETRIES} attempts`,
            attempts: newAttempts,
            next_retry_at: null, // Stop retrying
          })
          .eq('id', delivery.id)
        results.exhausted++
      } else {
        // Schedule next retry
        const nextRetry = calculateNextRetry(newAttempts)
        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: result.statusCode,
            response_body: result.error,
            attempts: newAttempts,
            next_retry_at: nextRetry.toISOString(),
          })
          .eq('id', delivery.id)
        results.failed++
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        exhausted: results.exhausted,
        message: `Processed ${results.processed} webhook deliveries`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook retry error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process webhook retries' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
