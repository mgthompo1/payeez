/**
 * PayPal PSP Adapter
 * Supports both:
 * - Advanced Card Payments (card processing through PayPal)
 * - PayPal Wallet payments (redirect flow)
 */

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  tokenId: string;
  cardData?: {
    cardNumber: string;
    cardHolderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvc: string;
  };
  idempotencyKey: string;
  capture: boolean;
  customerEmail?: string;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
  paymentMethodType?: 'card' | 'apple_pay' | 'google_pay' | 'bank_account' | 'paypal';
  merchantReference?: string;
  description?: string;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed' | 'refunded' | 'canceled' | 'pending' | 'requires_action';
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  failureCategory?: string;
  rawResponse: unknown;
  nextAction?: {
    type: 'redirect';
    url: string;
  };
}

interface PayPalCredentials {
  client_id: string;
  client_secret: string;
  environment?: 'sandbox' | 'live';
}

/**
 * Get PayPal API base URL based on environment
 */
function getPayPalBaseUrl(environment: 'sandbox' | 'live' = 'sandbox'): string {
  return environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Get PayPal access token using OAuth2 client credentials
 */
async function getAccessToken(credentials: PayPalCredentials): Promise<string> {
  const baseUrl = getPayPalBaseUrl(credentials.environment);
  const auth = btoa(`${credentials.client_id}:${credentials.client_secret}`);

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PayPal auth failed: ${error.error_description || error.message}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Map PayPal card brand to standard format
 */
function normalizeCardBrand(paypalBrand?: string): string {
  const brandMap: Record<string, string> = {
    'VISA': 'visa',
    'MASTERCARD': 'mastercard',
    'AMEX': 'amex',
    'DISCOVER': 'discover',
    'JCB': 'jcb',
    'DINERS': 'diners',
    'MAESTRO': 'maestro',
  };
  return brandMap[paypalBrand?.toUpperCase() || ''] || paypalBrand?.toLowerCase() || 'unknown';
}

/**
 * PayPal PSP Adapter
 */
export const paypalAdapter = {
  name: 'paypal' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: PayPalCredentials,
    _vaultApiKey: string
  ): Promise<AuthorizeResponse> {
    try {
      const accessToken = await getAccessToken(credentials);
      const baseUrl = getPayPalBaseUrl(credentials.environment);

      // Build PayPal order request
      const orderRequest: any = {
        intent: req.capture ? 'CAPTURE' : 'AUTHORIZE',
        purchase_units: [
          {
            reference_id: req.merchantReference || req.idempotencyKey,
            description: req.description,
            custom_id: req.merchantReference,
            amount: {
              currency_code: req.currency.toUpperCase(),
              value: (req.amount / 100).toFixed(2), // PayPal uses decimal format
            },
          },
        ],
        payment_source: {},
      };

      // Add card payment source if we have card data
      // PayPal Advanced Card Processing requires PCI DSS SAQ D compliance
      if (req.cardData) {
        // Expiry format: YYYY-MM (e.g., "2028-12")
        const expiryYear = req.cardData.expiryYear.length === 2
          ? `20${req.cardData.expiryYear}`
          : req.cardData.expiryYear;
        const expiryMonth = req.cardData.expiryMonth.padStart(2, '0');

        orderRequest.payment_source.card = {
          name: req.cardData.cardHolderName,
          number: req.cardData.cardNumber,
          security_code: req.cardData.cvc,
          expiry: `${expiryYear}-${expiryMonth}`,
        };

        // Add billing address if provided
        if (req.billingAddress) {
          orderRequest.payment_source.card.billing_address = {
            address_line_1: req.billingAddress.line1,
            address_line_2: req.billingAddress.line2,
            admin_area_2: req.billingAddress.city,
            admin_area_1: req.billingAddress.state,
            postal_code: req.billingAddress.postal_code,
            country_code: req.billingAddress.country?.toUpperCase() || 'US',
          };
        }

        // Request 3DS verification
        orderRequest.payment_source.card.attributes = {
          verification: {
            method: 'SCA_WHEN_REQUIRED',
          },
        };
      } else if (req.paymentMethodType === 'paypal') {
        // PayPal wallet payment - requires redirect
        orderRequest.payment_source.paypal = {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Atlas Payments',
            locale: 'en-US',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${Deno.env.get('ATLAS_BASE_URL') || 'https://api.atlas.io'}/paypal/return`,
            cancel_url: `${Deno.env.get('ATLAS_BASE_URL') || 'https://api.atlas.io'}/paypal/cancel`,
          },
        };

        if (req.customer?.email) {
          orderRequest.payment_source.paypal.email_address = req.customer.email;
        }
      }

      // Create the order
      const createResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': req.idempotencyKey,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(orderRequest),
      });

      const order = await createResponse.json();

      if (!createResponse.ok) {
        const errorDetails = order.details?.[0];
        return {
          success: false,
          transactionId: '',
          status: 'failed',
          failureCode: errorDetails?.issue || order.name || 'paypal_error',
          failureMessage: errorDetails?.description || order.message || 'PayPal order creation failed',
          failureCategory: 'processor_error',
          rawResponse: order,
        };
      }

      // Check order status
      if (order.status === 'COMPLETED') {
        // Payment completed (card payment that auto-captured)
        const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
        const cardInfo = order.payment_source?.card;

        return {
          success: true,
          transactionId: order.id,
          status: 'captured',
          card: cardInfo ? {
            brand: normalizeCardBrand(cardInfo.brand),
            last4: cardInfo.last_digits,
            exp_month: parseInt(cardInfo.expiry?.split('-')?.[1] || '0'),
            exp_year: parseInt(cardInfo.expiry?.split('-')?.[0] || '0'),
          } : undefined,
          rawResponse: order,
        };
      }

      if (order.status === 'APPROVED') {
        // Order approved - if AUTHORIZE intent, this means authorization succeeded
        // Need to call capture separately for CAPTURE intent
        const cardInfo = order.payment_source?.card;

        // For AUTHORIZE intent, authorization is in purchase_units[].payments.authorizations[]
        const authorization = order.purchase_units?.[0]?.payments?.authorizations?.[0];

        return {
          success: true,
          transactionId: order.id,
          status: 'authorized',
          card: cardInfo ? {
            brand: normalizeCardBrand(cardInfo.brand),
            last4: cardInfo.last_digits,
            exp_month: parseInt(cardInfo.expiry?.split('-')?.[1] || '0'),
            exp_year: parseInt(cardInfo.expiry?.split('-')?.[0] || '0'),
          } : undefined,
          rawResponse: order,
        };
      }

      if (order.status === 'PAYER_ACTION_REQUIRED') {
        // 3DS or PayPal redirect required
        const approveLink = order.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');

        return {
          success: false,
          transactionId: order.id,
          status: 'requires_action',
          rawResponse: order,
          nextAction: approveLink ? {
            type: 'redirect',
            url: approveLink.href,
          } : undefined,
        };
      }

      if (order.status === 'CREATED') {
        // PayPal wallet order created, needs approval
        const approveLink = order.links?.find((l: any) => l.rel === 'approve');

        return {
          success: false,
          transactionId: order.id,
          status: 'requires_action',
          rawResponse: order,
          nextAction: approveLink ? {
            type: 'redirect',
            url: approveLink.href,
          } : undefined,
        };
      }

      // Unexpected status
      return {
        success: false,
        transactionId: order.id || '',
        status: 'failed',
        failureCode: 'unexpected_status',
        failureMessage: `Unexpected order status: ${order.status}`,
        rawResponse: order,
      };

    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: 'paypal_error',
        failureMessage: error.message || 'PayPal request failed',
        failureCategory: 'processor_error',
        rawResponse: error,
      };
    }
  },

  async capture(
    transactionId: string,
    credentials: PayPalCredentials,
    amount?: number,
    currency?: string
  ): Promise<AuthorizeResponse> {
    try {
      const accessToken = await getAccessToken(credentials);
      const baseUrl = getPayPalBaseUrl(credentials.environment);

      // For PayPal, we capture the order (not a separate capture endpoint)
      const captureRequest: any = {};
      if (amount && currency) {
        captureRequest.amount = {
          currency_code: currency.toUpperCase(),
          value: (amount / 100).toFixed(2),
        };
      }

      const response = await fetch(`${baseUrl}/v2/checkout/orders/${transactionId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: Object.keys(captureRequest).length > 0 ? JSON.stringify(captureRequest) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureCode: result.details?.[0]?.issue || result.name,
          failureMessage: result.details?.[0]?.description || result.message,
          rawResponse: result,
        };
      }

      return {
        success: result.status === 'COMPLETED',
        transactionId: result.id,
        status: result.status === 'COMPLETED' ? 'captured' : 'failed',
        rawResponse: result,
      };

    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'paypal_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async refund(
    transactionId: string,
    amount: number,
    credentials: PayPalCredentials,
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    try {
      const accessToken = await getAccessToken(credentials);
      const baseUrl = getPayPalBaseUrl(credentials.environment);

      // First, get the capture ID from the order
      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const order = await orderResponse.json();
      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      if (!captureId) {
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureCode: 'no_capture',
          failureMessage: 'No capture found for this order',
          rawResponse: order,
        };
      }

      // Refund the capture
      const refundRequest = {
        amount: {
          currency_code: order.purchase_units?.[0]?.amount?.currency_code || 'USD',
          value: (amount / 100).toFixed(2),
        },
      };

      const response = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify(refundRequest),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureCode: result.details?.[0]?.issue || result.name,
          failureMessage: result.details?.[0]?.description || result.message,
          rawResponse: result,
        };
      }

      return {
        success: result.status === 'COMPLETED',
        transactionId: result.id,
        status: result.status === 'COMPLETED' ? 'refunded' : 'failed',
        rawResponse: result,
      };

    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'paypal_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async void(
    transactionId: string,
    credentials: PayPalCredentials
  ): Promise<AuthorizeResponse> {
    try {
      const accessToken = await getAccessToken(credentials);
      const baseUrl = getPayPalBaseUrl(credentials.environment);

      // For PayPal, we void authorizations (not orders)
      // First check if this is an authorized order
      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const order = await orderResponse.json();
      const authorizationId = order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

      if (!authorizationId) {
        // If no authorization, the order might be in CREATED state - we can just cancel
        return {
          success: true,
          transactionId,
          status: 'canceled',
          rawResponse: { message: 'Order not yet authorized - considered voided' },
        };
      }

      // Void the authorization
      const response = await fetch(`${baseUrl}/v2/payments/authorizations/${authorizationId}/void`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 204) {
        return {
          success: true,
          transactionId: authorizationId,
          status: 'canceled',
          rawResponse: { status: 'VOIDED' },
        };
      }

      const result = await response.json();
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: result.details?.[0]?.issue || result.name,
        failureMessage: result.details?.[0]?.description || result.message,
        rawResponse: result,
      };

    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'paypal_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  verifyWebhook(
    payload: string,
    headers: Record<string, string>,
    webhookId: string,
    credentials: PayPalCredentials
  ): boolean {
    // PayPal webhook verification is done server-side by calling their API
    // This is a simplified version - in production you'd call:
    // POST /v1/notifications/verify-webhook-signature
    console.log('[PayPal] Webhook verification requested for webhook ID:', webhookId);
    return true; // Placeholder - implement full verification
  },
};
