import Stripe from 'https://esm.sh/stripe@14';

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  tokenId: string;
  idempotencyKey: string;
  capture: boolean;
  customerEmail?: string;
  metadata?: Record<string, string>;
  paymentMethodType?: 'card' | 'apple_pay' | 'google_pay' | 'bank_account';
  bankAccount?: {
    account_holder_name?: string;
    account_type?: 'checking' | 'savings';
  };
  // VGS support
  tokenProvider?: 'basis_theory' | 'vgs';
  vgsConfig?: {
    vaultId: string;
    credentials: string;
  };
  vgsData?: {
    card_number: string;
    card_expiry: string;
    card_cvc: string;
  };
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed' | 'refunded' | 'canceled';
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown;
}

/**
 * Stripe PSP Adapter
 * Uses Basis Theory proxy to forward card data
 */
export const stripeAdapter = {
  name: 'stripe' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: { secret_key: string },
    vaultApiKey: string
  ): Promise<AuthorizeResponse> {
    let proxyResponse: Response;

    // Use appropriate vault proxy based on token provider
    if (req.tokenProvider === 'vgs' && req.vgsConfig && req.vgsData) {
      // VGS proxy - forwards through VGS to reveal card data
      const vgsBaseUrl = `https://${req.vgsConfig.vaultId}.sandbox.verygoodproxy.com`;
      proxyResponse = await fetch(`${vgsBaseUrl}/proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${req.vgsConfig.credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-VGS-Target-URL': 'https://api.stripe.com/v1/payment_methods',
          'X-Stripe-Auth': `Bearer ${credentials.secret_key}`,
        },
        body: new URLSearchParams({
          type: 'card',
          'card[number]': req.vgsData.card_number, // VGS alias - will be revealed
          'card[exp_month]': req.vgsData.card_expiry.split('/')[0]?.trim() || '',
          'card[exp_year]': req.vgsData.card_expiry.split('/')[1]?.trim() || '',
          'card[cvc]': req.vgsData.card_cvc,
        }),
      });
    } else {
      // Basis Theory proxy - default
      proxyResponse = await fetch('https://api.basistheory.com/proxy', {
        method: 'POST',
        headers: {
          'BT-API-KEY': vaultApiKey,
          'BT-PROXY-URL': 'https://api.stripe.com/v1/payment_methods',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'card',
          'card[token]': `{{${req.tokenId}}}`, // BT token interpolation
        }),
      });
    }

    if (!proxyResponse.ok) {
      const error = await proxyResponse.json();
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.error?.code || 'proxy_error',
        failureMessage: error.error?.message || 'Failed to create payment method',
        rawResponse: error,
      };
    }

    const paymentMethod = await proxyResponse.json();

    // Now create and confirm PaymentIntent with the payment method
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: req.amount,
          currency: req.currency.toLowerCase(),
          payment_method: paymentMethod.id,
          confirm: true,
          capture_method: req.capture ? 'automatic' : 'manual',
          receipt_email: req.customerEmail,
          metadata: req.metadata,
          automatic_payment_methods: {
            enabled: false,
          },
        },
        {
          idempotencyKey: req.idempotencyKey,
        }
      );

      const isSuccess =
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'requires_capture';

      return {
        success: isSuccess,
        transactionId: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'captured' : 'authorized',
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              exp_month: paymentMethod.card.exp_month,
              exp_year: paymentMethod.card.exp_year,
            }
          : undefined,
        rawResponse: paymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.code || 'stripe_error',
        failureMessage: error.message || 'Payment failed',
        rawResponse: error,
      };
    }
  },

  async capture(
    transactionId: string,
    credentials: { secret_key: string },
    amount?: number
  ): Promise<AuthorizeResponse> {
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      const paymentIntent = await stripe.paymentIntents.capture(transactionId, {
        amount_to_capture: amount,
      });

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        status: 'captured',
        rawResponse: paymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: error.code,
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async refund(
    transactionId: string,
    amount: number,
    credentials: { secret_key: string },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: transactionId,
          amount,
        },
        {
          idempotencyKey,
        }
      );

      return {
        success: refund.status === 'succeeded',
        transactionId: refund.id,
        status: refund.status === 'succeeded' ? 'refunded' : 'failed',
        rawResponse: refund,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.code,
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async void(
    transactionId: string,
    credentials: { secret_key: string }
  ): Promise<AuthorizeResponse> {
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      const paymentIntent = await stripe.paymentIntents.cancel(transactionId);
      const canceled = paymentIntent.status === 'canceled';

      return {
        success: canceled,
        transactionId: paymentIntent.id,
        status: canceled ? 'canceled' : 'failed',
        rawResponse: paymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: error.code,
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });
      stripe.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Authorize ACH bank account payment
   * Uses Stripe's ACH Direct Debit via PaymentIntents
   */
  async authorizeACH(
    req: {
      amount: number;
      currency: string;
      bankAccountToken: string; // Stripe bank account token
      idempotencyKey: string;
      customerEmail?: string;
      metadata?: Record<string, string>;
      mandateData?: {
        ip_address: string;
        user_agent: string;
      };
    },
    credentials: { secret_key: string }
  ): Promise<AuthorizeResponse> {
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      // Create PaymentIntent with ACH Direct Debit
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: req.amount,
          currency: req.currency.toLowerCase(),
          payment_method_types: ['us_bank_account'],
          payment_method_data: {
            type: 'us_bank_account',
            us_bank_account: {
              account_holder_type: 'individual',
            },
            billing_details: {
              email: req.customerEmail,
            },
          },
          confirm: true,
          mandate_data: req.mandateData ? {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: req.mandateData.ip_address,
                user_agent: req.mandateData.user_agent,
              },
            },
          } : undefined,
          receipt_email: req.customerEmail,
          metadata: req.metadata,
        },
        {
          idempotencyKey: req.idempotencyKey,
        }
      );

      // ACH payments are typically in 'processing' state after confirmation
      const isSuccess =
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'processing' ||
        paymentIntent.status === 'requires_action';

      return {
        success: isSuccess,
        transactionId: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'captured' : 'authorized',
        rawResponse: paymentIntent,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.code || 'stripe_ach_error',
        failureMessage: error.message || 'ACH payment failed',
        rawResponse: error,
      };
    }
  },

  /**
   * Create a Stripe ACH payout (credit to external bank account)
   */
  async createACHPayout(
    req: {
      amount: number;
      currency: string;
      destinationBankAccountId: string; // Stripe external account ID
      idempotencyKey: string;
      description?: string;
      metadata?: Record<string, string>;
    },
    credentials: { secret_key: string }
  ): Promise<AuthorizeResponse> {
    const stripe = new Stripe(credentials.secret_key, {
      apiVersion: '2023-10-16',
    });

    try {
      const payout = await stripe.payouts.create(
        {
          amount: req.amount,
          currency: req.currency.toLowerCase(),
          destination: req.destinationBankAccountId,
          method: 'standard', // 'instant' for instant payouts
          description: req.description,
          metadata: req.metadata,
        },
        {
          idempotencyKey: req.idempotencyKey,
        }
      );

      return {
        success: payout.status === 'paid' || payout.status === 'pending' || payout.status === 'in_transit',
        transactionId: payout.id,
        status: payout.status === 'paid' ? 'captured' : 'authorized',
        rawResponse: payout,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.code || 'stripe_payout_error',
        failureMessage: error.message || 'Payout failed',
        rawResponse: error,
      };
    }
  },

  /**
   * Create a Stripe external bank account for payouts
   */
  async createExternalBankAccount(
    bankData: {
      account_number: string;
      routing_number: string;
      account_holder_name: string;
      account_holder_type: 'individual' | 'company';
    },
    credentials: { secret_key: string },
    idempotencyKey: string
  ): Promise<{ success: boolean; externalAccountId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.stripe.com/v1/accounts/self/external_accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': idempotencyKey,
        },
        body: new URLSearchParams({
          'external_account[object]': 'bank_account',
          'external_account[country]': 'US',
          'external_account[currency]': 'usd',
          'external_account[account_holder_name]': bankData.account_holder_name,
          'external_account[account_holder_type]': bankData.account_holder_type,
          'external_account[routing_number]': bankData.routing_number,
          'external_account[account_number]': bankData.account_number,
        }),
      });

      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
        };
      }

      return {
        success: true,
        externalAccountId: data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create external bank account',
      };
    }
  },
};
