/**
 * ACH Webhooks Handler
 *
 * Handles webhooks from Stripe for ACH payment status updates.
 * Updates bank_transfer_attempts first, then propagates to bank_transfers.
 *
 * Stripe ACH Events (Modern PaymentIntents + us_bank_account):
 *   - payment_intent.processing - ACH debit pending
 *   - payment_intent.succeeded - ACH debit succeeded
 *   - payment_intent.payment_failed - ACH debit failed
 *   - payment_intent.requires_action - Verification needed
 *   - payout.paid - ACH credit completed
 *   - payout.failed - ACH credit failed
 *
 * Legacy Stripe Events (for backwards compatibility):
 *   - charge.succeeded - ACH debit succeeded
 *   - charge.failed - ACH debit failed
 *   - charge.pending - ACH debit pending
 *
 * ACH Return Codes (R01-R99):
 *   R01 - Insufficient funds
 *   R02 - Account closed
 *   R03 - No account/unable to locate
 *   R04 - Invalid account number
 *   R05 - Unauthorized debit
 *   R07 - Authorization revoked
 *   R08 - Payment stopped
 *   R10 - Customer advises not authorized
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ACH return code descriptions
const ACH_RETURN_CODES: Record<string, { description: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
  R01: { description: 'Insufficient funds', severity: 'medium' },
  R02: { description: 'Account closed', severity: 'high' },
  R03: { description: 'No account/unable to locate account', severity: 'high' },
  R04: { description: 'Invalid account number', severity: 'high' },
  R05: { description: 'Unauthorized debit to consumer account', severity: 'critical' },
  R06: { description: 'Returned per ODFI request', severity: 'medium' },
  R07: { description: 'Authorization revoked by customer', severity: 'critical' },
  R08: { description: 'Payment stopped', severity: 'high' },
  R09: { description: 'Uncollected funds', severity: 'medium' },
  R10: { description: 'Customer advises originator not authorized', severity: 'critical' },
  R11: { description: 'Check truncation entry return', severity: 'medium' },
  R12: { description: 'Branch sold to another DFI', severity: 'low' },
  R13: { description: 'RDFI not qualified to participate', severity: 'medium' },
  R14: { description: 'Representative payee deceased', severity: 'high' },
  R15: { description: 'Beneficiary or account holder deceased', severity: 'high' },
  R16: { description: 'Account frozen', severity: 'high' },
  R17: { description: 'File record edit criteria', severity: 'medium' },
  R20: { description: 'Non-transaction account', severity: 'medium' },
  R21: { description: 'Invalid company identification', severity: 'high' },
  R22: { description: 'Invalid individual ID number', severity: 'high' },
  R23: { description: 'Credit entry refused by receiver', severity: 'high' },
  R24: { description: 'Duplicate entry', severity: 'low' },
  R29: { description: 'Corporate customer advises not authorized', severity: 'critical' },
  R31: { description: 'Permissible return entry', severity: 'medium' },
  R33: { description: 'Return of XCK entry', severity: 'medium' },
};

function verifyStripeSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    const elements = signature.split(',');
    const signatureMap: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureMap[key] = value;
    }

    const timestamp = signatureMap['t'];
    const v1Signature = signatureMap['v1'];

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Check timestamp is within 5 minutes
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return v1Signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Find attempt and transfer by provider reference
 */
async function findAttemptByProviderRef(
  supabase: SupabaseClient,
  providerRef: string
): Promise<{
  attempt: {
    id: string;
    transfer_id: string;
    tenant_id: string;
    status: string;
  } | null;
  transfer: {
    id: string;
    tenant_id: string;
    bank_account_id: string;
    direction: string;
  } | null;
}> {
  // First try to find by attempt provider_reference (new pattern)
  const { data: attempt } = await supabase
    .from('bank_transfer_attempts')
    .select('id, transfer_id, tenant_id, status')
    .eq('provider_reference', providerRef)
    .single();

  if (attempt) {
    const { data: transfer } = await supabase
      .from('bank_transfers')
      .select('id, tenant_id, bank_account_id, direction')
      .eq('id', attempt.transfer_id)
      .single();

    return { attempt, transfer };
  }

  // Fallback: try to find by transfer provider_transfer_id (legacy pattern)
  const { data: legacyTransfer } = await supabase
    .from('bank_transfers')
    .select('id, tenant_id, bank_account_id, direction')
    .eq('provider_transfer_id', providerRef)
    .single();

  if (legacyTransfer) {
    // Get the latest attempt for this transfer
    const { data: latestAttempt } = await supabase
      .from('bank_transfer_attempts')
      .select('id, transfer_id, tenant_id, status')
      .eq('transfer_id', legacyTransfer.id)
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    return { attempt: latestAttempt, transfer: legacyTransfer };
  }

  return { attempt: null, transfer: null };
}

/**
 * Record webhook event in bank_transfer_events
 */
async function recordEvent(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    transferId: string;
    attemptId?: string;
    eventType: string;
    provider: string;
    providerEventId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from('bank_transfer_events').insert({
    tenant_id: params.tenantId,
    transfer_id: params.transferId,
    attempt_id: params.attemptId,
    event_type: params.eventType,
    provider: params.provider,
    provider_event_id: params.providerEventId,
    payload: params.payload,
    processed_at: new Date().toISOString(),
  });
}

/**
 * Update attempt and transfer status
 */
async function updateStatus(
  supabase: SupabaseClient,
  attemptId: string | null,
  transferId: string,
  status: 'processing' | 'settled' | 'failed' | 'returned',
  details?: {
    failureCode?: string;
    failureMessage?: string;
    failureCategory?: string;
    returnCode?: string;
    returnReason?: string;
    rawResponse?: unknown;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // Update attempt if exists
  if (attemptId) {
    const attemptUpdate: Record<string, unknown> = {
      status,
      updated_at: now,
    };

    if (status === 'settled') {
      attemptUpdate.settled_at = now;
    } else if (status === 'failed') {
      attemptUpdate.failed_at = now;
      attemptUpdate.failure_code = details?.failureCode;
      attemptUpdate.failure_message = details?.failureMessage;
      attemptUpdate.failure_category = details?.failureCategory;
    } else if (status === 'returned') {
      attemptUpdate.returned_at = now;
      attemptUpdate.return_code = details?.returnCode;
      attemptUpdate.return_reason = details?.returnReason;
      attemptUpdate.failure_code = details?.returnCode;
      attemptUpdate.failure_message = details?.returnReason;
      attemptUpdate.failure_category = 'ach_return';
    }

    if (details?.rawResponse) {
      attemptUpdate.raw_response = details.rawResponse;
    }

    await supabase
      .from('bank_transfer_attempts')
      .update(attemptUpdate)
      .eq('id', attemptId);
  }

  // Update transfer
  const transferUpdate: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === 'settled') {
    transferUpdate.settled_at = now;
  } else if (status === 'failed') {
    transferUpdate.failed_at = now;
    transferUpdate.failure_code = details?.failureCode;
    transferUpdate.failure_reason = details?.failureMessage;
  } else if (status === 'returned') {
    transferUpdate.returned_at = now;
    transferUpdate.return_code = details?.returnCode;
    transferUpdate.return_reason = details?.returnReason;
    transferUpdate.failure_code = details?.returnCode;
    transferUpdate.failure_reason = details?.returnReason;
  }

  await supabase
    .from('bank_transfers')
    .update(transferUpdate)
    .eq('id', transferId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeWebhookSecret = Deno.env.get('STRIPE_ACH_WEBHOOK_SECRET');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Verify signature if webhook secret is configured
    if (stripeWebhookSecret && signature) {
      if (!verifyStripeSignature(rawBody, signature, stripeWebhookSecret)) {
        console.error('[ACH Webhooks] Invalid signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const eventData = event.data.object;
    const providerRef = eventData.id;

    console.log(`[ACH Webhooks] Received event: ${eventType} for ${providerRef}`);

    // Find the attempt and transfer
    const { attempt, transfer } = await findAttemptByProviderRef(supabase, providerRef);

    if (!transfer) {
      console.log(`[ACH Webhooks] No transfer found for ${providerRef}, ignoring`);
      return new Response(
        JSON.stringify({ received: true, ignored: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the event
    await recordEvent(supabase, {
      tenantId: transfer.tenant_id,
      transferId: transfer.id,
      attemptId: attempt?.id,
      eventType: `stripe.${eventType}`,
      provider: 'stripe_ach',
      providerEventId: event.id,
      payload: eventData,
    });

    // Handle different event types
    switch (eventType) {
      // Modern PaymentIntent events (us_bank_account)
      case 'payment_intent.succeeded': {
        await updateStatus(supabase, attempt?.id || null, transfer.id, 'settled');
        console.log(`[ACH Webhooks] Transfer ${transfer.id} settled`);
        break;
      }

      case 'payment_intent.processing': {
        await updateStatus(supabase, attempt?.id || null, transfer.id, 'processing');
        console.log(`[ACH Webhooks] Transfer ${transfer.id} processing`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const error = eventData.last_payment_error;
        const achReturnCode = error?.payment_method?.us_bank_account?.status_details?.blocked?.reason;
        const isReturn = achReturnCode && achReturnCode.startsWith('R');

        if (isReturn) {
          const returnInfo = ACH_RETURN_CODES[achReturnCode] || { description: error?.message || 'Unknown return', severity: 'high' };

          await updateStatus(supabase, attempt?.id || null, transfer.id, 'returned', {
            returnCode: achReturnCode,
            returnReason: returnInfo.description,
            rawResponse: eventData,
          });

          // Record risk event for returns
          await supabase.from('bank_risk_events').insert({
            tenant_id: transfer.tenant_id,
            bank_account_id: transfer.bank_account_id,
            transfer_id: transfer.id,
            event_type: 'ach_return',
            severity: returnInfo.severity,
            description: `ACH Return: ${achReturnCode} - ${returnInfo.description}`,
            details: { return_code: achReturnCode, raw_response: eventData },
          });

          console.log(`[ACH Webhooks] Transfer ${transfer.id} returned: ${achReturnCode}`);
        } else {
          await updateStatus(supabase, attempt?.id || null, transfer.id, 'failed', {
            failureCode: error?.code || 'unknown',
            failureMessage: error?.message || 'Payment failed',
            failureCategory: 'provider_error',
            rawResponse: eventData,
          });

          console.log(`[ACH Webhooks] Transfer ${transfer.id} failed: ${error?.message}`);
        }
        break;
      }

      // Legacy charge events (backwards compatibility)
      case 'charge.succeeded': {
        await updateStatus(supabase, attempt?.id || null, transfer.id, 'settled');
        console.log(`[ACH Webhooks] Transfer ${transfer.id} settled (legacy charge)`);
        break;
      }

      case 'charge.pending': {
        await updateStatus(supabase, attempt?.id || null, transfer.id, 'processing');
        console.log(`[ACH Webhooks] Transfer ${transfer.id} processing (legacy charge)`);
        break;
      }

      case 'charge.failed': {
        const failureCode = eventData.failure_code || 'unknown';
        const failureMessage = eventData.failure_message || 'Payment failed';
        const achReturnCode = eventData.outcome?.reason || null;
        const isReturn = achReturnCode && achReturnCode.startsWith('R');

        if (isReturn) {
          const returnInfo = ACH_RETURN_CODES[achReturnCode] || { description: failureMessage, severity: 'high' };

          await updateStatus(supabase, attempt?.id || null, transfer.id, 'returned', {
            returnCode: achReturnCode,
            returnReason: returnInfo.description,
            rawResponse: eventData,
          });

          // Record risk event
          await supabase.from('bank_risk_events').insert({
            tenant_id: transfer.tenant_id,
            bank_account_id: transfer.bank_account_id,
            transfer_id: transfer.id,
            event_type: 'ach_return',
            severity: returnInfo.severity,
            description: `ACH Return: ${achReturnCode} - ${returnInfo.description}`,
            details: { return_code: achReturnCode, raw_response: eventData },
          });

          console.log(`[ACH Webhooks] Transfer ${transfer.id} returned (legacy): ${achReturnCode}`);
        } else {
          await updateStatus(supabase, attempt?.id || null, transfer.id, 'failed', {
            failureCode,
            failureMessage,
            failureCategory: 'provider_error',
            rawResponse: eventData,
          });

          console.log(`[ACH Webhooks] Transfer ${transfer.id} failed (legacy): ${failureMessage}`);
        }
        break;
      }

      // Payout events (ACH credits)
      case 'payout.paid': {
        await updateStatus(supabase, attempt?.id || null, transfer.id, 'settled');
        console.log(`[ACH Webhooks] Payout ${transfer.id} settled`);
        break;
      }

      case 'payout.failed': {
        const failureCode = eventData.failure_code || 'unknown';
        const failureMessage = eventData.failure_message || 'Payout failed';

        await updateStatus(supabase, attempt?.id || null, transfer.id, 'failed', {
          failureCode,
          failureMessage,
          failureCategory: 'provider_error',
          rawResponse: eventData,
        });

        // Record risk event for payout failures
        await supabase.from('bank_risk_events').insert({
          tenant_id: transfer.tenant_id,
          bank_account_id: transfer.bank_account_id,
          transfer_id: transfer.id,
          event_type: 'payout_failed',
          severity: 'high',
          description: `Payout failed: ${failureMessage}`,
          details: { failure_code: failureCode, raw_response: eventData },
        });

        console.log(`[ACH Webhooks] Payout ${transfer.id} failed: ${failureMessage}`);
        break;
      }

      default:
        console.log(`[ACH Webhooks] Unhandled event type: ${eventType}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ACH Webhooks] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
