/**
 * Process ACH Transfers
 *
 * Scheduled function that processes pending bank transfers via Stripe ACH.
 * Should be called via cron every 5 minutes.
 *
 * Routes:
 *   POST /process-ach-transfers/run     - Process all pending transfers
 *   POST /process-ach-transfers/:id     - Process a specific transfer
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash, createDecipheriv } from 'node:crypto';
import { buildCorsHeaders } from '../_shared/auth.ts';

// ============================================
// Vault Functions
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
// Stripe ACH Processing
// ============================================

interface StripeACHResult {
  success: boolean;
  chargeId?: string;
  payoutId?: string;
  error?: string;
  errorCode?: string;
}

async function processStripeACHDebit(
  stripeSecretKey: string,
  bankAccount: {
    account_number: string;
    routing_number: string;
    holder_name: string;
    account_type: string;
  },
  amount: number,
  currency: string,
  description: string,
  idempotencyKey: string
): Promise<StripeACHResult> {
  try {
    // Step 1: Create a bank account token
    const tokenResponse = await fetch('https://api.stripe.com/v1/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `${idempotencyKey}_token`,
      },
      body: new URLSearchParams({
        'bank_account[country]': 'US',
        'bank_account[currency]': currency.toLowerCase(),
        'bank_account[account_holder_name]': bankAccount.holder_name,
        'bank_account[account_holder_type]': 'individual',
        'bank_account[routing_number]': bankAccount.routing_number,
        'bank_account[account_number]': bankAccount.account_number,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return {
        success: false,
        error: tokenData.error.message,
        errorCode: tokenData.error.code,
      };
    }

    // Step 2: Create a charge using the bank account token
    const chargeResponse = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `${idempotencyKey}_charge`,
      },
      body: new URLSearchParams({
        'amount': amount.toString(),
        'currency': currency.toLowerCase(),
        'source': tokenData.id,
        'description': description,
      }),
    });

    const chargeData = await chargeResponse.json();

    if (chargeData.error) {
      return {
        success: false,
        error: chargeData.error.message,
        errorCode: chargeData.error.code,
      };
    }

    return {
      success: true,
      chargeId: chargeData.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      errorCode: 'processing_error',
    };
  }
}

async function processStripeACHCredit(
  stripeSecretKey: string,
  bankAccount: {
    account_number: string;
    routing_number: string;
    holder_name: string;
    account_type: string;
  },
  amount: number,
  currency: string,
  description: string,
  idempotencyKey: string
): Promise<StripeACHResult> {
  try {
    // For credits (payouts), we need to use Stripe Connect or create an external account
    // This is a simplified version - in production you'd use Stripe Connect

    // Step 1: Create or get a connected account for the recipient
    // For now, we'll create a payout to an external account

    // Create external account on the platform
    const externalAccountResponse = await fetch(
      'https://api.stripe.com/v1/accounts/self/external_accounts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': `${idempotencyKey}_ext_account`,
        },
        body: new URLSearchParams({
          'external_account[object]': 'bank_account',
          'external_account[country]': 'US',
          'external_account[currency]': currency.toLowerCase(),
          'external_account[account_holder_name]': bankAccount.holder_name,
          'external_account[account_holder_type]': 'individual',
          'external_account[routing_number]': bankAccount.routing_number,
          'external_account[account_number]': bankAccount.account_number,
        }),
      }
    );

    const externalAccountData = await externalAccountResponse.json();

    if (externalAccountData.error) {
      // If account already exists, that's fine
      if (externalAccountData.error.code !== 'bank_account_exists') {
        return {
          success: false,
          error: externalAccountData.error.message,
          errorCode: externalAccountData.error.code,
        };
      }
    }

    // Step 2: Create a payout
    const payoutResponse = await fetch('https://api.stripe.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `${idempotencyKey}_payout`,
      },
      body: new URLSearchParams({
        'amount': amount.toString(),
        'currency': currency.toLowerCase(),
        'destination': externalAccountData.id,
        'description': description,
        'method': 'standard', // or 'instant' for instant payouts
      }),
    });

    const payoutData = await payoutResponse.json();

    if (payoutData.error) {
      return {
        success: false,
        error: payoutData.error.message,
        errorCode: payoutData.error.code,
      };
    }

    return {
      success: true,
      payoutId: payoutData.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      errorCode: 'processing_error',
    };
  }
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
          holder_name
        )
      `)
      .eq('settlement_provider', 'stripe_ach')
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
        // Get Stripe credentials for this tenant
        const { data: credentials } = await supabase
          .from('psp_credentials')
          .select('credentials_encrypted')
          .eq('tenant_id', transfer.tenant_id)
          .eq('psp', 'stripe')
          .eq('is_active', true)
          .single();

        if (!credentials) {
          results.failed++;
          results.errors.push({
            transferId: transfer.id,
            error: 'Stripe credentials not configured',
          });

          await supabase
            .from('bank_transfers')
            .update({
              status: 'failed',
              failure_code: 'no_credentials',
              failure_reason: 'Stripe credentials not configured',
              failed_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          continue;
        }

        // Decrypt bank account data
        const bankData = decryptBankData(transfer.bank_accounts.vault_token);

        // Update to processing
        await supabase
          .from('bank_transfers')
          .update({
            status: 'processing',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', transfer.id);

        // Decrypt Stripe credentials
        // Note: In production, use proper decryption
        let stripeKey: string;
        try {
          const decrypted = JSON.parse(credentials.credentials_encrypted);
          stripeKey = decrypted.secret_key;
        } catch {
          stripeKey = credentials.credentials_encrypted;
        }

        // Process based on direction
        let result: StripeACHResult;
        const idempotencyKey = transfer.idempotency_key || `ach_${transfer.id}`;

        if (transfer.direction === 'debit') {
          result = await processStripeACHDebit(
            stripeKey,
            bankData,
            transfer.amount,
            transfer.currency,
            transfer.description || `ACH Debit ${transfer.id}`,
            idempotencyKey
          );
        } else {
          result = await processStripeACHCredit(
            stripeKey,
            bankData,
            transfer.amount,
            transfer.currency,
            transfer.description || `ACH Credit ${transfer.id}`,
            idempotencyKey
          );
        }

        if (result.success) {
          // Calculate expected settlement (2-5 business days for ACH)
          const expectedSettlement = new Date();
          expectedSettlement.setDate(expectedSettlement.getDate() + 3);

          await supabase
            .from('bank_transfers')
            .update({
              status: 'processing', // Will be 'settled' when webhook confirms
              provider_transfer_id: result.chargeId || result.payoutId,
              settlement_reference: result.chargeId || result.payoutId,
              expected_settlement_at: expectedSettlement.toISOString(),
            })
            .eq('id', transfer.id);

          results.succeeded++;

          console.log(`[ProcessACH] Transfer ${transfer.id} submitted: ${result.chargeId || result.payoutId}`);
        } else {
          await supabase
            .from('bank_transfers')
            .update({
              status: 'failed',
              failure_code: result.errorCode,
              failure_reason: result.error,
              failed_at: new Date().toISOString(),
            })
            .eq('id', transfer.id);

          results.failed++;
          results.errors.push({
            transferId: transfer.id,
            error: result.error || 'Unknown error',
          });

          console.error(`[ProcessACH] Transfer ${transfer.id} failed:`, result.error);
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
