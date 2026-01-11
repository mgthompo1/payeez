/**
 * ACH Webhooks Handler
 *
 * Handles webhooks from Stripe for ACH payment status updates.
 *
 * Stripe ACH Events:
 *   - charge.succeeded - ACH debit succeeded
 *   - charge.failed - ACH debit failed
 *   - charge.pending - ACH debit pending
 *   - payout.paid - ACH credit completed
 *   - payout.failed - ACH credit failed
 *   - source.chargeable - Bank account verified (for Sources API)
 *   - payment_intent.processing - Payment processing
 *   - payment_intent.succeeded - Payment succeeded
 *   - payment_intent.payment_failed - Payment failed
 *
 * ACH Return Codes (R01-R99):
 *   R01 - Insufficient funds
 *   R02 - Account closed
 *   R03 - No account/unable to locate
 *   R04 - Invalid account number
 *   R05 - Unauthorized debit
 *   R06 - ODFI request
 *   R07 - Authorization revoked
 *   R08 - Payment stopped
 *   R09 - Uncollected funds
 *   R10 - Customer advises not authorized
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ACH return code descriptions
const ACH_RETURN_CODES: Record<string, string> = {
  R01: 'Insufficient funds',
  R02: 'Account closed',
  R03: 'No account/unable to locate account',
  R04: 'Invalid account number',
  R05: 'Unauthorized debit to consumer account',
  R06: 'Returned per ODFI request',
  R07: 'Authorization revoked by customer',
  R08: 'Payment stopped',
  R09: 'Uncollected funds',
  R10: 'Customer advises originator not authorized',
  R11: 'Check truncation entry return',
  R12: 'Branch sold to another DFI',
  R13: 'RDFI not qualified to participate',
  R14: 'Representative payee deceased',
  R15: 'Beneficiary or account holder deceased',
  R16: 'Account frozen',
  R17: 'File record edit criteria',
  R20: 'Non-transaction account',
  R21: 'Invalid company identification',
  R22: 'Invalid individual ID number',
  R23: 'Credit entry refused by receiver',
  R24: 'Duplicate entry',
  R29: 'Corporate customer advises not authorized',
  R31: 'Permissible return entry',
  R33: 'Return of XCK entry',
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

    console.log(`[ACH Webhooks] Received event: ${eventType}`);

    // Find the transfer by provider_transfer_id
    let transferId: string | null = null;
    let providerRef = eventData.id;

    // Handle different event types
    switch (eventType) {
      case 'charge.succeeded': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          await supabase
            .from('bank_transfers')
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          console.log(`[ACH Webhooks] Transfer ${transfer.id} settled`);
        }
        break;
      }

      case 'charge.failed': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id, tenant_id, bank_account_id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          const failureCode = eventData.failure_code || 'unknown';
          const failureMessage = eventData.failure_message || 'Payment failed';

          // Check if this is an ACH return
          const achReturnCode = eventData.outcome?.reason || null;
          const isReturn = achReturnCode && achReturnCode.startsWith('R');

          await supabase
            .from('bank_transfers')
            .update({
              status: isReturn ? 'returned' : 'failed',
              failure_code: failureCode,
              failure_reason: failureMessage,
              failed_at: new Date().toISOString(),
              return_code: isReturn ? achReturnCode : null,
              return_reason: isReturn ? ACH_RETURN_CODES[achReturnCode] || failureMessage : null,
              returned_at: isReturn ? new Date().toISOString() : null,
            })
            .eq('id', transfer.id);

          // Record risk event for returns
          if (isReturn) {
            await supabase.from('bank_risk_events').insert({
              tenant_id: transfer.tenant_id,
              bank_account_id: transfer.bank_account_id,
              transfer_id: transfer.id,
              event_type: 'ach_return',
              severity: ['R05', 'R07', 'R10', 'R29'].includes(achReturnCode) ? 'critical' : 'high',
              description: `ACH Return: ${achReturnCode} - ${ACH_RETURN_CODES[achReturnCode] || failureMessage}`,
              details: { return_code: achReturnCode, raw_response: eventData },
            });
          }

          console.log(`[ACH Webhooks] Transfer ${transfer.id} ${isReturn ? 'returned' : 'failed'}: ${failureMessage}`);
        }
        break;
      }

      case 'charge.pending': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          await supabase
            .from('bank_transfers')
            .update({
              status: 'processing',
            })
            .eq('id', transfer.id);

          console.log(`[ACH Webhooks] Transfer ${transfer.id} processing`);
        }
        break;
      }

      case 'payout.paid': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          await supabase
            .from('bank_transfers')
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          console.log(`[ACH Webhooks] Payout ${transfer.id} settled`);
        }
        break;
      }

      case 'payout.failed': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id, tenant_id, bank_account_id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          const failureCode = eventData.failure_code || 'unknown';
          const failureMessage = eventData.failure_message || 'Payout failed';

          await supabase
            .from('bank_transfers')
            .update({
              status: 'failed',
              failure_code: failureCode,
              failure_reason: failureMessage,
              failed_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          // Record risk event
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
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // For PaymentIntents with ACH
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          await supabase
            .from('bank_transfers')
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('id, tenant_id, bank_account_id')
          .eq('provider_transfer_id', providerRef)
          .single();

        if (transfer) {
          const error = eventData.last_payment_error;
          await supabase
            .from('bank_transfers')
            .update({
              status: 'failed',
              failure_code: error?.code || 'unknown',
              failure_reason: error?.message || 'Payment failed',
              failed_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);
        }
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
