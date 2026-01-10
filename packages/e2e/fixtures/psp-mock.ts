import { test as base, Page, Route } from '@playwright/test';

/**
 * PSP Mock Fixture
 *
 * Provides utilities to mock PSP responses for testing orchestration scenarios:
 * - Failover testing (PSP A fails, fallback to PSP B)
 * - Traffic splitting verification
 * - 3DS challenge flows
 * - Specific error code responses
 */

export interface PSPMockConfig {
  psp: string;
  shouldSucceed?: boolean;
  errorCode?: string;
  errorMessage?: string;
  delay?: number;
  require3DS?: boolean;
  avsResult?: string;
  cvvResult?: string;
}

export interface PSPMockFixtures {
  mockPSP: (config: PSPMockConfig) => Promise<void>;
  mockPSPSequence: (configs: PSPMockConfig[]) => Promise<void>;
  mockWindcave: (overrides?: Partial<PSPMockConfig>) => Promise<void>;
  mockStripe: (overrides?: Partial<PSPMockConfig>) => Promise<void>;
  clearPSPMocks: () => Promise<void>;
}

// Windcave sandbox URL pattern
const WINDCAVE_PATTERN = /uat\.windcave\.com|sec\.windcave\.com/;
// Stripe API pattern
const STRIPE_PATTERN = /api\.stripe\.com/;
// Supabase edge functions pattern
const SUPABASE_FUNCTIONS_PATTERN = /supabase\.co\/functions/;

/**
 * Generate a mock Windcave response
 */
function createWindcaveResponse(config: PSPMockConfig): object {
  const transactionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  if (!config.shouldSucceed) {
    return {
      id: transactionId,
      authorised: false,
      reCo: config.errorCode || 'DO',
      responseText: config.errorMessage || 'DECLINED',
      type: 'purchase',
    };
  }

  return {
    id: transactionId,
    authorised: true,
    reCo: '00',
    responseText: 'APPROVED',
    authCode: 'ABC123',
    type: 'purchase',
    amount: '10.00',
    currency: 'NZD',
    card: {
      type: 'visa',
      cardNumber: '411111******1111',
      dateExpiryMonth: '12',
      dateExpiryYear: '25',
    },
    avs: config.avsResult ? { avsResult: config.avsResult } : undefined,
    cvc2Result: config.cvvResult,
    threeDSecure: config.require3DS
      ? {
          status: 'Y',
          version: '2.2.0',
          eci: '05',
        }
      : undefined,
  };
}

/**
 * Generate a mock Stripe response
 */
function createStripeResponse(config: PSPMockConfig): object {
  const paymentIntentId = `pi_mock_${Date.now()}`;

  if (!config.shouldSucceed) {
    return {
      error: {
        type: 'card_error',
        code: config.errorCode || 'card_declined',
        message: config.errorMessage || 'Your card was declined',
        decline_code: 'generic_decline',
      },
    };
  }

  return {
    id: paymentIntentId,
    object: 'payment_intent',
    amount: 1000,
    currency: 'nzd',
    status: 'succeeded',
    payment_method: 'pm_mock',
    charges: {
      data: [
        {
          id: `ch_mock_${Date.now()}`,
          paid: true,
          status: 'succeeded',
          payment_method_details: {
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025,
            },
          },
        },
      ],
    },
  };
}

/**
 * Extended test with PSP mock fixtures
 */
export const test = base.extend<PSPMockFixtures>({
  mockPSP: async ({ page }, use) => {
    const mocks: Array<() => Promise<void>> = [];

    const mockPSP = async (config: PSPMockConfig) => {
      const pattern =
        config.psp === 'windcave'
          ? WINDCAVE_PATTERN
          : config.psp === 'stripe'
            ? STRIPE_PATTERN
            : new RegExp(config.psp);

      const handler = async (route: Route) => {
        // Apply delay if specified
        if (config.delay) {
          await new Promise((r) => setTimeout(r, config.delay));
        }

        const response =
          config.psp === 'windcave'
            ? createWindcaveResponse(config)
            : config.psp === 'stripe'
              ? createStripeResponse(config)
              : { mock: true, ...config };

        await route.fulfill({
          status: config.shouldSucceed ? 200 : 400,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      };

      await page.route(pattern, handler);
      mocks.push(() => page.unroute(pattern, handler));
    };

    await use(mockPSP);

    // Cleanup all mocks
    for (const cleanup of mocks) {
      await cleanup();
    }
  },

  mockPSPSequence: async ({ page }, use) => {
    let callIndex = 0;
    const mocks: Array<() => Promise<void>> = [];

    const mockPSPSequence = async (configs: PSPMockConfig[]) => {
      for (const config of configs) {
        const pattern =
          config.psp === 'windcave'
            ? WINDCAVE_PATTERN
            : config.psp === 'stripe'
              ? STRIPE_PATTERN
              : new RegExp(config.psp);

        const handler = async (route: Route) => {
          const currentConfig = configs[callIndex % configs.length];
          callIndex++;

          if (currentConfig.delay) {
            await new Promise((r) => setTimeout(r, currentConfig.delay));
          }

          const response =
            currentConfig.psp === 'windcave'
              ? createWindcaveResponse(currentConfig)
              : currentConfig.psp === 'stripe'
                ? createStripeResponse(currentConfig)
                : { mock: true, ...currentConfig };

          await route.fulfill({
            status: currentConfig.shouldSucceed ? 200 : 400,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        };

        await page.route(pattern, handler);
        mocks.push(() => page.unroute(pattern, handler));
      }
    };

    await use(mockPSPSequence);

    for (const cleanup of mocks) {
      await cleanup();
    }
  },

  mockWindcave: async ({ mockPSP }, use) => {
    const mockWindcave = async (overrides: Partial<PSPMockConfig> = {}) => {
      await mockPSP({
        psp: 'windcave',
        shouldSucceed: true,
        ...overrides,
      });
    };

    await use(mockWindcave);
  },

  mockStripe: async ({ mockPSP }, use) => {
    const mockStripe = async (overrides: Partial<PSPMockConfig> = {}) => {
      await mockPSP({
        psp: 'stripe',
        shouldSucceed: true,
        ...overrides,
      });
    };

    await use(mockStripe);
  },

  clearPSPMocks: async ({ page }, use) => {
    const clearPSPMocks = async () => {
      await page.unroute(WINDCAVE_PATTERN);
      await page.unroute(STRIPE_PATTERN);
    };

    await use(clearPSPMocks);
  },
});

export { expect } from '@playwright/test';
