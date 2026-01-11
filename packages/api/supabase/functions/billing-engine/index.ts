/**
 * Billing Engine
 *
 * Scheduled function that runs every 5 minutes to handle:
 * 1. Generate invoices for subscriptions approaching period end
 * 2. Finalize draft invoices (auto_advance)
 * 3. Charge open invoices
 * 4. Smart retry failed payments
 * 5. End trials and transition to active
 * 6. Cancel subscriptions after retry exhaustion
 *
 * This should be called via a cron trigger (e.g., Supabase pg_cron or external scheduler)
 *
 * Routes:
 *   POST /billing-engine/run - Trigger billing engine manually
 *   POST /billing-engine/generate-invoices - Generate invoices for due subscriptions
 *   POST /billing-engine/charge-invoices - Attempt to charge open invoices
 *   POST /billing-engine/process-retries - Process failed payment retries
 *   POST /billing-engine/end-trials - End trials and start billing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/auth.ts';
import {
  sendInvoiceEmail,
  sendPaymentReceiptEmail,
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendSubscriptionCanceledEmail,
} from '../_shared/email.ts';
import { chargeToken } from '../_shared/payment-processor.ts';

interface BillingJob {
  id: string;
  tenant_id: string;
  job_type: string;
  target_id: string;
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
  status: string;
}

// Default retry schedule (in hours)
const DEFAULT_RETRY_SCHEDULE = [0, 24, 72, 168, 336]; // Immediate, 1d, 3d, 7d, 14d

function calculatePeriodEnd(start: Date, interval: string, intervalCount: number): Date {
  const end = new Date(start);
  switch (interval) {
    case 'day':
      end.setDate(end.getDate() + intervalCount);
      break;
    case 'week':
      end.setDate(end.getDate() + (7 * intervalCount));
      break;
    case 'month':
      end.setMonth(end.getMonth() + intervalCount);
      break;
    case 'year':
      end.setFullYear(end.getFullYear() + intervalCount);
      break;
  }
  return end;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts.length > 1 ? pathParts[1] : 'run';

    const results: Record<string, any> = {
      action,
      timestamp: new Date().toISOString(),
      processed: {},
    };

    // Generate invoices for subscriptions 1 day before period end
    if (action === 'run' || action === 'generate-invoices') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find active subscriptions with period ending within 24 hours that don't have a pending invoice
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_items (
            id,
            price_id,
            quantity,
            prices (
              id,
              product_id,
              unit_amount,
              currency,
              type,
              recurring_interval,
              recurring_interval_count,
              recurring_usage_type
            )
          )
        `)
        .in('status', ['active', 'past_due'])
        .lte('current_period_end', tomorrow.toISOString())
        .eq('cancel_at_period_end', false);

      if (subError) {
        console.error('[BillingEngine] Error fetching subscriptions:', subError);
      }

      let invoicesCreated = 0;

      for (const sub of subscriptions || []) {
        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('period_start', sub.current_period_start)
          .single();

        if (existingInvoice) continue;

        // Calculate invoice totals from subscription items
        let subtotal = 0;
        const currency = sub.subscription_items?.[0]?.prices?.currency || 'usd';

        for (const item of sub.subscription_items || []) {
          const price = item.prices;
          if (price?.unit_amount) {
            subtotal += price.unit_amount * item.quantity;
          }
        }

        // Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            tenant_id: sub.tenant_id,
            customer_id: sub.customer_id,
            subscription_id: sub.id,
            status: 'draft',
            collection_method: sub.collection_method,
            currency,
            subtotal,
            tax: 0,
            total: subtotal,
            period_start: sub.current_period_start,
            period_end: sub.current_period_end,
            auto_advance: true,
          })
          .select()
          .single();

        if (invoiceError) {
          console.error('[BillingEngine] Error creating invoice:', invoiceError);
          continue;
        }

        // Create invoice line items
        for (const item of sub.subscription_items || []) {
          const price = item.prices;
          if (!price) continue;

          await supabase.from('invoice_line_items').insert({
            invoice_id: invoice.id,
            price_id: price.id,
            description: `Subscription to ${price.product_id}`,
            quantity: item.quantity,
            unit_amount: price.unit_amount || 0,
            amount: (price.unit_amount || 0) * item.quantity,
            currency: price.currency,
            period_start: sub.current_period_start,
            period_end: sub.current_period_end,
          });
        }

        invoicesCreated++;
      }

      results.processed.invoicesCreated = invoicesCreated;
    }

    // Finalize draft invoices with auto_advance
    if (action === 'run' || action === 'finalize-invoices') {
      const { data: draftInvoices, error: draftError } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_line_items (*),
          customers (id, email, name),
          tenants (name)
        `)
        .eq('status', 'draft')
        .eq('auto_advance', true);

      if (draftError) {
        console.error('[BillingEngine] Error fetching draft invoices:', draftError);
      }

      let invoicesFinalized = 0;

      for (const invoice of draftInvoices || []) {
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'open',
            finalized_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        if (!error) {
          invoicesFinalized++;

          // Send invoice email
          if (invoice.customers?.email) {
            const webUrl = Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io';
            await sendInvoiceEmail({
              customerEmail: invoice.customers.email,
              customerName: invoice.customers.name,
              invoiceNumber: invoice.number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
              invoiceId: invoice.id,
              amountDue: invoice.total || 0,
              currency: invoice.currency || 'usd',
              dueDate: invoice.due_date,
              lineItems: (invoice.invoice_line_items || []).map((item: any) => ({
                description: item.description || 'Subscription',
                amount: item.amount || 0,
              })),
              payUrl: `${webUrl}/invoice/${invoice.id}`,
              merchantName: invoice.tenants?.name || 'Merchant',
            });
          }
        }
      }

      results.processed.invoicesFinalized = invoicesFinalized;
    }

    // Charge open invoices
    if (action === 'run' || action === 'charge-invoices') {
      const { data: openInvoices, error: openError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            id,
            email,
            name,
            default_token_id
          ),
          subscriptions (
            default_token_id
          ),
          tenants (name)
        `)
        .eq('status', 'open')
        .eq('collection_method', 'charge_automatically');

      if (openError) {
        console.error('[BillingEngine] Error fetching open invoices:', openError);
      }

      let invoicesCharged = 0;
      let invoicesFailed = 0;

      for (const invoice of openInvoices || []) {
        const tokenId = invoice.subscriptions?.default_token_id || invoice.customers?.default_token_id;

        if (!tokenId) {
          // No payment method, mark as past_due
          await supabase
            .from('invoices')
            .update({ status: 'past_due' })
            .eq('id', invoice.id);
          invoicesFailed++;
          continue;
        }

        // Charge the invoice using the real payment orchestrator
        const chargeResult = await chargeToken(supabase, {
          tenantId: invoice.tenant_id,
          tokenId: tokenId,
          amount: invoice.total,
          currency: invoice.currency,
          customerEmail: invoice.customers?.email,
          customerName: invoice.customers?.name,
          description: `Invoice ${invoice.number || invoice.id}`,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription_id,
          idempotencyKey: `invoice_${invoice.id}_${Date.now()}`,
        });

        if (chargeResult.success) {
          const paidAt = new Date().toISOString();
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: paidAt,
            })
            .eq('id', invoice.id);

          console.log(`[BillingEngine] Invoice ${invoice.id} charged successfully:`, {
            psp: chargeResult.psp,
            transactionId: chargeResult.transactionId,
            amount: invoice.total,
            currency: invoice.currency,
            attempts: chargeResult.attempts,
          });

          // Send payment receipt email
          if (invoice.customers?.email) {
            await sendPaymentReceiptEmail({
              customerEmail: invoice.customers.email,
              customerName: invoice.customers.name,
              amount: invoice.total || 0,
              currency: invoice.currency || 'usd',
              paymentDate: paidAt,
              invoiceNumber: invoice.number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
              merchantName: invoice.tenants?.name || 'Merchant',
            });
          }

          // Update subscription period
          if (invoice.subscription_id) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('*, subscription_items(prices(recurring_interval, recurring_interval_count))')
              .eq('id', invoice.subscription_id)
              .single();

            if (sub) {
              const price = sub.subscription_items?.[0]?.prices;
              const newPeriodStart = new Date(sub.current_period_end);
              const newPeriodEnd = calculatePeriodEnd(
                newPeriodStart,
                price?.recurring_interval || 'month',
                price?.recurring_interval_count || 1
              );

              await supabase
                .from('subscriptions')
                .update({
                  current_period_start: newPeriodStart.toISOString(),
                  current_period_end: newPeriodEnd.toISOString(),
                  status: 'active',
                })
                .eq('id', invoice.subscription_id);
            }
          }

          invoicesCharged++;
        } else {
          // Schedule retry
          await supabase
            .from('invoices')
            .update({ status: 'past_due' })
            .eq('id', invoice.id);

          // Create billing job for retry
          const retryDate = new Date();
          retryDate.setHours(retryDate.getHours() + 24); // First retry in 24 hours

          await supabase.from('billing_jobs').insert({
            tenant_id: invoice.tenant_id,
            job_type: 'retry_payment',
            target_id: invoice.id,
            scheduled_for: retryDate.toISOString(),
            status: 'pending',
          });

          // Send payment failed email with actual failure reason
          const webUrl = Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io';
          const failureReason = chargeResult.failureMessage || chargeResult.failureCode || 'Your payment method was declined';
          if (invoice.customers?.email) {
            await sendPaymentFailedEmail({
              customerEmail: invoice.customers.email,
              customerName: invoice.customers.name,
              amount: invoice.total || 0,
              currency: invoice.currency || 'usd',
              reason: failureReason,
              retryDate: retryDate.toISOString(),
              updatePaymentUrl: `${webUrl}/portal/${invoice.tenant_id}`,
              merchantName: invoice.tenants?.name || 'Merchant',
            });
          }

          console.log(`[BillingEngine] Invoice ${invoice.id} charge failed:`, {
            psp: chargeResult.psp,
            code: chargeResult.failureCode,
            message: chargeResult.failureMessage,
            attempts: chargeResult.attempts,
          });

          invoicesFailed++;
        }
      }

      results.processed.invoicesCharged = invoicesCharged;
      results.processed.invoicesFailed = invoicesFailed;
    }

    // Process payment retries
    if (action === 'run' || action === 'process-retries') {
      const now = new Date();

      const { data: retryJobs, error: retryError } = await supabase
        .from('billing_jobs')
        .select('*')
        .eq('job_type', 'retry_payment')
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString());

      if (retryError) {
        console.error('[BillingEngine] Error fetching retry jobs:', retryError);
      }

      let retriesProcessed = 0;
      let retriesSucceeded = 0;

      for (const job of retryJobs || []) {
        // Get invoice and attempt charge
        const { data: invoice } = await supabase
          .from('invoices')
          .select(`
            *,
            customers (id, email, name, default_token_id),
            subscriptions (default_token_id)
          `)
          .eq('id', job.target_id)
          .single();

        if (!invoice || invoice.status === 'paid') {
          await supabase
            .from('billing_jobs')
            .update({ status: 'completed' })
            .eq('id', job.id);
          continue;
        }

        // Get the token ID for the retry
        const tokenId = invoice.subscriptions?.default_token_id || invoice.customers?.default_token_id;

        if (!tokenId) {
          // No payment method, mark job as failed
          await supabase
            .from('billing_jobs')
            .update({
              status: 'failed',
              attempts: job.attempts + 1,
              last_error: 'No payment method available',
            })
            .eq('id', job.id);
          continue;
        }

        // Retry charge using the real payment orchestrator
        const chargeResult = await chargeToken(supabase, {
          tenantId: invoice.tenant_id,
          tokenId: tokenId,
          amount: invoice.total,
          currency: invoice.currency,
          customerEmail: invoice.customers?.email,
          customerName: invoice.customers?.name,
          description: `Invoice ${invoice.number || invoice.id} (retry ${job.attempts + 1})`,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription_id,
          idempotencyKey: `invoice_retry_${invoice.id}_${job.attempts + 1}_${Date.now()}`,
        });

        if (chargeResult.success) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          await supabase
            .from('billing_jobs')
            .update({ status: 'completed' })
            .eq('id', job.id);

          // Update subscription status
          if (invoice.subscription_id) {
            await supabase
              .from('subscriptions')
              .update({ status: 'active' })
              .eq('id', invoice.subscription_id);
          }

          retriesSucceeded++;
        } else {
          const attempts = job.attempts + 1;
          const failureReason = chargeResult.failureMessage || chargeResult.failureCode || 'Payment failed';

          if (attempts >= DEFAULT_RETRY_SCHEDULE.length) {
            // Max retries reached, mark as uncollectible
            await supabase
              .from('invoices')
              .update({ status: 'uncollectible' })
              .eq('id', invoice.id);

            await supabase
              .from('billing_jobs')
              .update({
                status: 'failed',
                attempts,
                last_error: `Max retries exceeded: ${failureReason}`,
              })
              .eq('id', job.id);

            // Cancel subscription
            if (invoice.subscription_id) {
              await supabase
                .from('subscriptions')
                .update({
                  status: 'unpaid',
                  canceled_at: new Date().toISOString(),
                })
                .eq('id', invoice.subscription_id);
            }
          } else {
            // Schedule next retry
            const nextRetryHours = DEFAULT_RETRY_SCHEDULE[attempts];
            const nextRetryDate = new Date();
            nextRetryDate.setHours(nextRetryDate.getHours() + nextRetryHours);

            await supabase
              .from('billing_jobs')
              .update({
                status: 'pending',
                attempts,
                scheduled_for: nextRetryDate.toISOString(),
                last_error: failureReason,
              })
              .eq('id', job.id);
          }
        }

        retriesProcessed++;
      }

      results.processed.retriesProcessed = retriesProcessed;
      results.processed.retriesSucceeded = retriesSucceeded;
    }

    // Send trial ending notifications (3 days before)
    if (action === 'run' || action === 'trial-reminders') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysFromNowEnd = new Date(threeDaysFromNow);
      threeDaysFromNowEnd.setHours(23, 59, 59, 999);

      const { data: trialEndingSubs, error: trialNotifyError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customers (id, email, name),
          subscription_items (
            prices (
              unit_amount,
              currency,
              recurring_interval,
              products (name)
            )
          ),
          tenants (name)
        `)
        .eq('status', 'trialing')
        .gte('trial_end', threeDaysFromNow.toISOString())
        .lte('trial_end', threeDaysFromNowEnd.toISOString())
        .is('trial_reminder_sent', null);

      if (trialNotifyError) {
        console.error('[BillingEngine] Error fetching trial ending subscriptions:', trialNotifyError);
      }

      let trialRemindersSent = 0;

      for (const sub of trialEndingSubs || []) {
        if (sub.customers?.email) {
          const price = sub.subscription_items?.[0]?.prices;
          const webUrl = Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io';

          await sendTrialEndingEmail({
            customerEmail: sub.customers.email,
            customerName: sub.customers.name,
            productName: price?.products?.name || 'Subscription',
            trialEndDate: sub.trial_end,
            amount: price?.unit_amount || 0,
            currency: price?.currency || 'usd',
            interval: price?.recurring_interval || 'month',
            merchantName: sub.tenants?.name || 'Merchant',
            portalUrl: `${webUrl}/portal/${sub.tenant_id}`,
          });

          // Mark reminder as sent
          await supabase
            .from('subscriptions')
            .update({ trial_reminder_sent: new Date().toISOString() })
            .eq('id', sub.id);

          trialRemindersSent++;
        }
      }

      results.processed.trialRemindersSent = trialRemindersSent;
    }

    // End trials
    if (action === 'run' || action === 'end-trials') {
      const now = new Date();

      const { data: trialingSubscriptions, error: trialError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'trialing')
        .lte('trial_end', now.toISOString());

      if (trialError) {
        console.error('[BillingEngine] Error fetching trialing subscriptions:', trialError);
      }

      let trialsEnded = 0;

      for (const sub of trialingSubscriptions || []) {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('id', sub.id);

        trialsEnded++;
      }

      results.processed.trialsEnded = trialsEnded;
    }

    // Handle subscriptions set to cancel at period end
    if (action === 'run' || action === 'cancel-expired') {
      const now = new Date();

      const { data: cancelingSubscriptions, error: cancelError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customers (id, email, name),
          subscription_items (
            prices (
              products (name)
            )
          ),
          tenants (name)
        `)
        .eq('cancel_at_period_end', true)
        .lte('current_period_end', now.toISOString())
        .neq('status', 'canceled');

      if (cancelError) {
        console.error('[BillingEngine] Error fetching canceling subscriptions:', cancelError);
      }

      let subscriptionsCanceled = 0;

      for (const sub of cancelingSubscriptions || []) {
        const canceledAt = new Date().toISOString();

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: canceledAt,
            ended_at: canceledAt,
          })
          .eq('id', sub.id);

        // Send subscription canceled email
        if (sub.customers?.email) {
          const productName = sub.subscription_items?.[0]?.prices?.products?.name || 'Subscription';
          const webUrl = Deno.env.get('PUBLIC_WEB_URL') || 'https://atlas.io';

          await sendSubscriptionCanceledEmail({
            customerEmail: sub.customers.email,
            customerName: sub.customers.name,
            productName,
            endDate: sub.current_period_end,
            merchantName: sub.tenants?.name || 'Merchant',
            resubscribeUrl: `${webUrl}/checkout/${sub.tenant_id}`,
          });
        }

        subscriptionsCanceled++;
      }

      results.processed.subscriptionsCanceled = subscriptionsCanceled;
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[BillingEngine] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error' } }),
      { status: 500, headers: { ...buildCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});
