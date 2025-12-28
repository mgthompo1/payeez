/**
 * Test Cards Reference Endpoint
 *
 * Returns available test card numbers and their behaviors
 * Only accessible in test mode (with sk_test_* API key)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateApiKey, corsHeaders, errorResponse, successResponse } from '../_shared/auth.ts'

const TEST_CARDS = {
  success: {
    description: 'Cards that will successfully complete payments',
    cards: [
      {
        number: '4242424242424242',
        brand: 'visa',
        cvc: 'any 3 digits',
        expiry: 'any future date',
        description: 'Succeeds and immediately captures',
      },
      {
        number: '4000056655665556',
        brand: 'visa_debit',
        cvc: 'any 3 digits',
        expiry: 'any future date',
        description: 'Visa debit - succeeds',
      },
      {
        number: '5555555555554444',
        brand: 'mastercard',
        cvc: 'any 3 digits',
        expiry: 'any future date',
        description: 'Mastercard - succeeds',
      },
      {
        number: '5200828282828210',
        brand: 'mastercard_debit',
        cvc: 'any 3 digits',
        expiry: 'any future date',
        description: 'Mastercard debit - succeeds',
      },
      {
        number: '378282246310005',
        brand: 'amex',
        cvc: 'any 4 digits',
        expiry: 'any future date',
        description: 'American Express - succeeds',
      },
      {
        number: '6011111111111117',
        brand: 'discover',
        cvc: 'any 3 digits',
        expiry: 'any future date',
        description: 'Discover - succeeds',
      },
    ],
  },

  decline: {
    description: 'Cards that simulate various decline scenarios',
    cards: [
      {
        number: '4000000000000002',
        brand: 'visa',
        decline_code: 'card_declined',
        description: 'Generic decline',
      },
      {
        number: '4000000000009995',
        brand: 'visa',
        decline_code: 'insufficient_funds',
        description: 'Insufficient funds',
      },
      {
        number: '4000000000009987',
        brand: 'visa',
        decline_code: 'lost_card',
        description: 'Lost card',
      },
      {
        number: '4000000000009979',
        brand: 'visa',
        decline_code: 'stolen_card',
        description: 'Stolen card',
      },
      {
        number: '4000000000000069',
        brand: 'visa',
        decline_code: 'expired_card',
        description: 'Expired card',
      },
      {
        number: '4000000000000127',
        brand: 'visa',
        decline_code: 'incorrect_cvc',
        description: 'Incorrect CVC',
      },
      {
        number: '4000000000000119',
        brand: 'visa',
        decline_code: 'processing_error',
        description: 'Processing error',
      },
    ],
  },

  threeds: {
    description: '3D Secure test cards',
    cards: [
      {
        number: '4000000000003220',
        brand: 'visa',
        threeds_version: '2.1.0',
        outcome: 'authenticated',
        description: '3DS 2 - authentication succeeds',
      },
      {
        number: '4000000000003063',
        brand: 'visa',
        threeds_version: '2.2.0',
        outcome: 'authenticated',
        description: '3DS 2.2 - authentication succeeds',
      },
      {
        number: '4000002500003155',
        brand: 'visa',
        threeds_version: '2.1.0',
        outcome: 'authentication_failed',
        description: '3DS required - authentication fails',
      },
      {
        number: '4000008260003178',
        brand: 'visa',
        threeds_version: '2.1.0',
        outcome: 'challenge_required',
        description: '3DS challenge flow required',
      },
    ],
  },

  fraud: {
    description: 'Cards that trigger fraud detection',
    cards: [
      {
        number: '4100000000000019',
        brand: 'visa',
        risk_level: 'highest',
        description: 'Always blocked as high risk',
      },
      {
        number: '4000000000004954',
        brand: 'visa',
        risk_level: 'elevated',
        description: 'Elevated risk - may require review',
      },
    ],
  },

  dispute: {
    description: 'Cards that simulate disputes/chargebacks',
    cards: [
      {
        number: '4000000000000259',
        brand: 'visa',
        dispute_type: 'general',
        description: 'Creates a dispute after payment',
      },
      {
        number: '4000000000001976',
        brand: 'visa',
        dispute_type: 'fraudulent',
        description: 'Creates a fraudulent dispute',
      },
    ],
  },

  international: {
    description: 'International test cards',
    cards: [
      {
        number: '4000000760000002',
        brand: 'visa',
        country: 'BR',
        description: 'Brazil',
      },
      {
        number: '4000001240000000',
        brand: 'visa',
        country: 'CA',
        description: 'Canada',
      },
      {
        number: '4000004840000008',
        brand: 'visa',
        country: 'MX',
        description: 'Mexico',
      },
    ],
  },
}

const TEST_TOKENS = {
  description: 'Pre-generated test tokens for API testing',
  tokens: [
    {
      token: 'tok_visa',
      card: '4242424242424242',
      description: 'Successful Visa card token',
    },
    {
      token: 'tok_visa_debit',
      card: '4000056655665556',
      description: 'Successful Visa debit token',
    },
    {
      token: 'tok_mastercard',
      card: '5555555555554444',
      description: 'Successful Mastercard token',
    },
    {
      token: 'tok_amex',
      card: '378282246310005',
      description: 'Successful Amex token',
    },
    {
      token: 'tok_chargeDeclined',
      card: '4000000000000002',
      description: 'Token that will be declined',
    },
    {
      token: 'tok_chargeInsufficientFunds',
      card: '4000000000009995',
      description: 'Token declined for insufficient funds',
    },
    {
      token: 'tok_threeDSecure2Required',
      card: '4000000000003220',
      description: 'Token requiring 3DS authentication',
    },
  ],
}

const TEST_AMOUNTS = {
  description: 'Special amount values that trigger specific behaviors',
  amounts: [
    {
      amount: 100,
      currency: 'any',
      description: 'Standard successful payment (1.00)',
    },
    {
      amount: 0,
      currency: 'any',
      description: 'Zero amount - useful for card verification',
    },
    {
      amount: 999999999,
      currency: 'any',
      description: 'Very large amount - may trigger fraud rules',
    },
  ],
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    // Authenticate API key
    const auth = await authenticateApiKey(
      req.headers.get('authorization'),
      supabaseUrl,
      supabaseServiceKey
    )

    if (!auth) {
      return errorResponse('unauthorized', 'Invalid or missing API key', 401)
    }

    // Only allow in test mode
    if (auth.environment !== 'test') {
      return errorResponse(
        'test_mode_only',
        'This endpoint is only available in test mode. Use a test API key (sk_test_*).',
        403
      )
    }

    const url = new URL(req.url)
    const category = url.searchParams.get('category')

    // Return specific category or all
    if (category) {
      const data = TEST_CARDS[category as keyof typeof TEST_CARDS]
      if (!data) {
        return errorResponse(
          'invalid_category',
          `Unknown category: ${category}. Valid categories: ${Object.keys(TEST_CARDS).join(', ')}`,
          400
        )
      }
      return successResponse({ category, ...data })
    }

    // Return everything
    return successResponse({
      cards: TEST_CARDS,
      tokens: TEST_TOKENS,
      amounts: TEST_AMOUNTS,
      usage: {
        cvc: 'Use any 3 digits (4 digits for Amex)',
        expiry: 'Use any future date (MM/YY)',
        zip: 'Use any valid ZIP code',
        api_key: 'Use your sk_test_* API key to enable test mode',
      },
    })
  } catch (error) {
    console.error('Test cards endpoint error:', error)
    return errorResponse('server_error', 'Internal server error', 500)
  }
})
