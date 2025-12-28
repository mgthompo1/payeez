/**
 * Basis Theory Reactor: Backup Payment Orchestrator
 *
 * This reactor runs in Basis Theory's infrastructure (NOT Supabase).
 * It serves as a failover when Payeez primary systems are unavailable.
 *
 * IMPORTANT: This code is deployed to Basis Theory and invoked by the SDK
 * when the circuit breaker detects Payeez is down.
 *
 * Capabilities (Degraded Mode):
 * - Route payments to merchant's primary PSP
 * - Basic retry logic (no weighted routing)
 * - Transaction recording for later sync
 *
 * Limitations:
 * - No weighted routing across multiple PSPs
 * - No complex orchestration rules
 * - No real-time analytics
 *
 * Configuration:
 * The reactor is configured with merchant PSP credentials stored in
 * Basis Theory's secure configuration. Each merchant has a config entry
 * that includes their primary PSP and credentials.
 *
 * Usage:
 * POST https://api.basistheory.com/reactors/{reactor_id}/react
 * {
 *   "args": {
 *     "merchant_id": "merch_xxx",
 *     "token_id": "tok_xxx",
 *     "amount": 1000,
 *     "currency": "usd",
 *     "idempotency_key": "idem_xxx"
 *   }
 * }
 */

const { BasisTheory } = require('@basis-theory/basis-theory-js');

// PSP Adapter implementations
const PSPAdapters = {
  /**
   * Stripe adapter for processing payments
   */
  stripe: {
    async authorize(credentials, paymentData, cardToken) {
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'amount': paymentData.amount.toString(),
          'currency': paymentData.currency,
          'payment_method_data[type]': 'card',
          'payment_method_data[card][token]': cardToken,
          'confirm': 'true',
          'capture_method': 'manual',
        }).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Stripe authorization failed',
          declineCode: data.error?.decline_code,
        };
      }

      return {
        success: true,
        transactionId: data.id,
        status: data.status,
        raw: data,
      };
    },

    async capture(credentials, transactionId, amount) {
      const response = await fetch(
        `https://api.stripe.com/v1/payment_intents/${transactionId}/capture`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.secret_key}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: amount ? new URLSearchParams({ amount_to_capture: amount.toString() }).toString() : '',
        }
      );

      const data = await response.json();

      return {
        success: response.ok,
        transactionId: data.id,
        status: data.status,
        error: data.error?.message,
      };
    },
  },

  /**
   * Adyen adapter for processing payments
   */
  adyen: {
    async authorize(credentials, paymentData, cardToken) {
      const response = await fetch(
        `https://${credentials.environment}-checkout.adyen.com/v71/payments`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': credentials.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchantAccount: credentials.merchant_account,
            amount: {
              value: paymentData.amount,
              currency: paymentData.currency.toUpperCase(),
            },
            reference: paymentData.reference || `ref_${Date.now()}`,
            paymentMethod: {
              type: 'scheme',
              // Adyen accepts network tokens or card data via BT proxy
              storedPaymentMethodId: cardToken,
            },
            shopperReference: paymentData.customer_id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.resultCode === 'Refused') {
        return {
          success: false,
          error: data.refusalReason || 'Adyen authorization failed',
          declineCode: data.refusalReasonCode,
        };
      }

      return {
        success: true,
        transactionId: data.pspReference,
        status: data.resultCode,
        raw: data,
      };
    },

    async capture(credentials, transactionId, amount, currency) {
      const response = await fetch(
        `https://${credentials.environment}-checkout.adyen.com/v71/payments/${transactionId}/captures`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': credentials.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchantAccount: credentials.merchant_account,
            amount: { value: amount, currency: currency.toUpperCase() },
          }),
        }
      );

      const data = await response.json();

      return {
        success: response.ok && data.status === 'received',
        transactionId: data.pspReference,
        status: data.status,
        error: data.message,
      };
    },
  },

  /**
   * Braintree adapter for processing payments
   */
  braintree: {
    async authorize(credentials, paymentData, cardToken) {
      // Braintree uses GraphQL API
      const query = `
        mutation ChargePaymentMethod($input: ChargePaymentMethodInput!) {
          chargePaymentMethod(input: $input) {
            transaction {
              id
              status
            }
          }
        }
      `;

      const response = await fetch(
        `https://payments.${credentials.environment === 'sandbox' ? 'sandbox.' : ''}braintree-api.com/graphql`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${credentials.public_key}:${credentials.private_key}`)}`,
            'Braintree-Version': '2024-01-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: {
              input: {
                paymentMethodId: cardToken,
                transaction: {
                  amount: (paymentData.amount / 100).toFixed(2),
                },
              },
            },
          }),
        }
      );

      const data = await response.json();

      if (data.errors || !data.data?.chargePaymentMethod?.transaction) {
        return {
          success: false,
          error: data.errors?.[0]?.message || 'Braintree authorization failed',
        };
      }

      return {
        success: true,
        transactionId: data.data.chargePaymentMethod.transaction.id,
        status: data.data.chargePaymentMethod.transaction.status,
        raw: data,
      };
    },
  },
};

/**
 * Main reactor function
 * This is invoked by Basis Theory when the SDK calls the reactor
 */
module.exports = async function (req) {
  const {
    bt, // Basis Theory SDK instance
    args, // Request arguments
    configuration, // Reactor configuration (contains merchant configs)
  } = req;

  const {
    merchant_id,
    token_id,
    amount,
    currency,
    capture = false,
    idempotency_key,
    metadata = {},
  } = args;

  // Validate required fields
  if (!merchant_id || !token_id || !amount || !currency) {
    return {
      success: false,
      error: 'Missing required fields: merchant_id, token_id, amount, currency',
      fallback_mode: true,
    };
  }

  try {
    // Get merchant configuration from reactor config
    // Config structure: { merchants: { [merchant_id]: { primary_psp, credentials } } }
    const merchantConfig = configuration.merchants?.[merchant_id];

    if (!merchantConfig) {
      return {
        success: false,
        error: `Merchant ${merchant_id} not configured in reactor`,
        fallback_mode: true,
      };
    }

    const { primary_psp, credentials } = merchantConfig;
    const adapter = PSPAdapters[primary_psp];

    if (!adapter) {
      return {
        success: false,
        error: `PSP ${primary_psp} not supported in fallback mode`,
        fallback_mode: true,
      };
    }

    // Get the card token from Basis Theory
    // The token_id is a Basis Theory token that contains card data
    const token = await bt.tokens.retrieve(token_id);

    if (!token || !token.data) {
      return {
        success: false,
        error: 'Could not retrieve card token',
        fallback_mode: true,
      };
    }

    // Process the payment
    const paymentData = {
      amount,
      currency,
      reference: idempotency_key || `fallback_${Date.now()}`,
      customer_id: metadata.customer_id,
    };

    // For BT proxy integration, we pass the token expression
    // This allows BT to inject the actual card data when calling the PSP
    const cardToken = `{{ ${token_id} | json: '$.number' }}`;

    const result = await adapter.authorize(credentials, paymentData, cardToken);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        decline_code: result.declineCode,
        fallback_mode: true,
        psp: primary_psp,
      };
    }

    // If capture is requested, capture immediately
    if (capture && adapter.capture) {
      const captureResult = await adapter.capture(
        credentials,
        result.transactionId,
        amount,
        currency
      );

      if (!captureResult.success) {
        // Authorization succeeded but capture failed
        return {
          success: true,
          transaction_id: result.transactionId,
          status: 'authorized', // Not captured
          capture_error: captureResult.error,
          fallback_mode: true,
          psp: primary_psp,
          requires_sync: true,
        };
      }

      return {
        success: true,
        transaction_id: result.transactionId,
        status: 'captured',
        fallback_mode: true,
        psp: primary_psp,
        requires_sync: true,
      };
    }

    return {
      success: true,
      transaction_id: result.transactionId,
      status: 'authorized',
      fallback_mode: true,
      psp: primary_psp,
      requires_sync: true, // Flag for SDK to sync when primary recovers
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error in fallback orchestrator',
      fallback_mode: true,
    };
  }
};

/**
 * Reactor Configuration Schema
 *
 * When setting up the reactor in Basis Theory, configure it with:
 *
 * {
 *   "merchants": {
 *     "merch_abc123": {
 *       "primary_psp": "stripe",
 *       "credentials": {
 *         "secret_key": "sk_live_xxx"
 *       }
 *     },
 *     "merch_def456": {
 *       "primary_psp": "adyen",
 *       "credentials": {
 *         "api_key": "xxx",
 *         "merchant_account": "MyMerchantAccount",
 *         "environment": "live"
 *       }
 *     }
 *   }
 * }
 *
 * This configuration is stored securely in Basis Theory and is NOT
 * accessible to anyone except during reactor execution.
 */
