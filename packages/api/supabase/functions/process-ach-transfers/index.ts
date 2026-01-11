/**
 * Process ACH Transfers
 *
 * Scheduled function that processes pending bank transfers via ACH adapters.
 * Should be called via cron every 5 minutes.
 *
 * Uses the multi-rail ACH orchestrator to:
 * - Select the best provider (Stripe, Moov, NACHA, etc.)
 * - Create audit trail via bank_transfer_attempts
 * - Handle failures and retries
 *
 * Routes:
 *   POST /process-ach-transfers/run     - Process all pending transfers
 *   POST /process-ach-transfers/:id     - Process a specific transfer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash, createDecipheriv } from 'node:crypto';
import { buildCorsHeaders } from '../_shared/auth.ts';
import { decryptJson } from '../_shared/crypto.ts';
import {
  executeACHDebit,
  executeACHCredit,
  type ACHSettlementRequest,
  type ACHProviderName,
} from '../_shared/ach/index.ts';

// ============================================
// Vault Functions (for bank account data)
// ============================================

function getEncryptionKey(): Uint8Array {
  const key = Deno.env.get('BANK_VAULT_KEY') || Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!key) {
    throw new Error('BANK_VAULT_KEY environment variable is required');
  }
  return createHash('sha256').update(key).digest();
}

function decryptBankData(vaultToken: string): {
  account_number: string;
  routing_number: string;
  holder_name: string;
  account_type: string;
} {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encrypted] = vaultToken.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const transferId = pathParts.length > 1 && pathParts[1] !== 'run' ? pathParts[1] : null;

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ transferId: string; error: string }>,
    };

    // Get transfers to process
    let query = supabase
      .from('bank_transfers')
      .select(`
        *,
        bank_accounts (
          id,
          vault_token,
          tenant_id,
          holder_name,
          account_type
        ),
        bank_mandates (
          id,
          authorization_text,
          accepted_at,
          ip_address,
          user_agent
        )
      `)
      .in('settlement_provider', ['stripe_ach', 'moov', 'paypal_ach', 'nacha'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (transferId) {
      query = query.eq('id', transferId);
    }

    const { data: transfers, error: fetchError } = await query;

    if (fetchError) {
      console.error('[ProcessACH] Error fetching transfers:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transfers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const transfer of transfers || []) {
      results.processed++;

      try {
        // Decrypt bank account data
        const bankData = decryptBankData(transfer.bank_accounts.vault_token);

        // Get the current attempt number
        const { count: existingAttempts } = await supabase
          .from('bank_transfer_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('transfer_id', transfer.id);

        const attemptNumber = (existingAttempts || 0) + 1;
        const idempotencyKey = `${transfer.id}_${attemptNumber}`;

        // Create attempt record BEFORE processing
        const { data: attempt, error: attemptError } = await supabase
          .from('bank_transfer_attempts')
          .insert({
            transfer_id: transfer.id,
            tenant_id: transfer.tenant_id,
            mandate_id: transfer.mandate_id,
            settlement_provider: transfer.settlement_provider,
            attempt_number: attemptNumber,
            idempotency_key: idempotencyKey,
            amount: transfer.amount,
            currency: transfer.currency,
            direction: transfer.direction,
            status: 'pending',
          })
          .select()
          .single();

        if (attemptError) {
          console.error('[ProcessACH] Failed to create attempt:', attemptError);
          results.failed++;
          results.errors.push({
            transferId: transfer.id,
            error: 'Failed to create attempt record',
          });
          continue;
        }

        // Update transfer to processing
        await supabase
          .from('bank_transfers')
          .update({
            status: 'processing',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', transfer.id);

        // Build the settlement request
        const settlementRequest: ACHSettlementRequest = {
          transferId: transfer.id,
          bankAccount: {
            accountNumber: bankData.account_number,
            routingNumber: bankData.routing_number,
            accountType: (bankData.account_type as 'checking' | 'savings') || 'checking',
            accountHolderName: bankData.holder_name,
            accountHolderType: 'individual', // Could be enhanced
          },
          amount: transfer.amount,
          currency: transfer.currency,
          direction: transfer.direction,
          mandate: transfer.bank_mandates ? {
            id: transfer.bank_mandates.id,
            authorizationText: transfer.bank_mandates.authorization_text,
            acceptedAt: transfer.bank_mandates.accepted_at,
            ipAddress: transfer.bank_mandates.ip_address,
          } : undefined,
          idempotencyKey,
          description: transfer.statement_descriptor || transfer.internal_description,
          metadata: transfer.metadata,
        };

        // Execute through the ACH orchestrator
        const { response, routing } = transfer.direction === 'debit'
          ? await executeACHDebit(settlementRequest, transfer.tenant_id, supabase)
          : await executeACHCredit(settlementRequest, transfer.tenant_id, supabase);

        // Update the attempt with the result
        await supabase
          .from('bank_transfer_attempts')
          .update({
            status: response.status,
            provider_reference: response.providerId,
            estimated_settlement_at: response.estimatedSettlementAt,
            failure_code: response.failureCode,
            failure_message: response.failureMessage,
            failure_category: response.failureCategory,
            return_code: response.returnCode,
            return_reason: response.returnReason,
            raw_response: response.rawResponse,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', attempt.id);

        // Record the routing decision
        await supabase
          .from('bank_transfer_events')
          .insert({
            tenant_id: transfer.tenant_id,
            transfer_id: transfer.id,
            attempt_id: attempt.id,
            event_type: 'transfer.submitted',
            provider: routing.provider,
            payload: {
              routing_strategy: routing.reason,
              routing_factors: routing.factors,
              alternatives: routing.alternativesConsidered,
            },
          });

        if (response.success) {
          // Update transfer with provider reference
          await supabase
            .from('bank_transfers')
            .update({
              status: response.status === 'settled' ? 'settled' : 'processing',
              provider_transfer_id: response.providerId,
              settlement_reference: response.providerId,
              expected_settlement_at: response.estimatedSettlementAt,
              routing_strategy: routing.reason,
              routing_reason: {
                provider: routing.provider,
                factors: routing.factors,
              },
            })
            .eq('id', transfer.id);

          results.succeeded++;
          console.log(`[ProcessACH] Transfer ${transfer.id} submitted via ${routing.provider}: ${response.providerId}`);
        } else {
          // Update transfer as failed
          await supabase
            .from('bank_transfers')
            .update({
              status: 'failed',
              failure_code: response.failureCode,
              failure_reason: response.failureMessage,
              failed_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          results.failed++;
          results.errors.push({
            transferId: transfer.id,
            error: response.failureMessage || 'Unknown error',
          });

          console.error(`[ProcessACH] Transfer ${transfer.id} failed:`, response.failureMessage);
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          transferId: transfer.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });

        await supabase
          .from('bank_transfers')
          .update({
            status: 'failed',
            failure_code: 'processing_error',
            failure_reason: err instanceof Error ? err.message : 'Unknown error',
            failed_at: new Date().toISOString(),
          })
          .eq('id', transfer.id);

        console.error(`[ProcessACH] Transfer ${transfer.id} error:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ProcessACH] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
