import Stripe from 'https://esm.sh/stripe@14';

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  tokenId: string;
  idempotencyKey: string;
  capture: boolean;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed';
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
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    // Use Basis Theory's proxy to create a Stripe PaymentMethod
    // This keeps us out of PCI scope - BT handles the card data
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': 'https://api.stripe.com/v1/payment_methods',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        type: 'card',
        'card[token]': `{{${req.tokenId}}}`, // BT token interpolation
      }),
    });

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
        status: refund.status === 'succeeded' ? 'captured' : 'failed',
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
};
