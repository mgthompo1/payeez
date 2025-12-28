// ============================================
// PSP Adapter Registry
// ============================================

import { BasePSPAdapter } from './base'
import { StripeAdapter } from './stripe'
import { AdyenAdapter } from './adyen'
import { TestAdapter, isTestMode, getTestCardNumbers, TEST_CARDS } from './test'
import type { PSPName, PSPCredentials } from '../types'

// Extended PSP name to include test mode
export type PSPNameWithTest = PSPName | 'test'

function makeUnimplementedAdapter(name: PSPName): new (credentials: PSPCredentials) => BasePSPAdapter {
  return class UnimplementedAdapter extends BasePSPAdapter {
    constructor(credentials: PSPCredentials) {
      super(name, credentials)
    }

    protected getBaseUrl(): string {
      return ''
    }

    async charge(): Promise<any> {
      throw new Error(`${name} adapter not implemented`)
    }

    async capture(): Promise<any> {
      throw new Error(`${name} adapter not implemented`)
    }

    async refund(): Promise<any> {
      throw new Error(`${name} adapter not implemented`)
    }

    async void(): Promise<{ success: boolean; error?: string }> {
      throw new Error(`${name} adapter not implemented`)
    }

    async initiate3DS(): Promise<any> {
      throw new Error(`${name} adapter not implemented`)
    }

    verifyWebhook(): boolean {
      return false
    }

    parseWebhook(): { event_type: string; raw: Record<string, unknown> } {
      return { event_type: 'unknown', raw: {} }
    }

    protected async ping(): Promise<void> {
      throw new Error(`${name} adapter not implemented`)
    }
  }
}

// Registry of all available PSP adapters
const adapterRegistry: Record<PSPName, new (credentials: PSPCredentials) => BasePSPAdapter> = {
  stripe: StripeAdapter,
  adyen: AdyenAdapter,
  authorizenet: makeUnimplementedAdapter('authorizenet'),
  chase: makeUnimplementedAdapter('chase'),
  braintree: makeUnimplementedAdapter('braintree'),
  checkoutcom: makeUnimplementedAdapter('checkoutcom'),
  nuvei: makeUnimplementedAdapter('nuvei'),
  dlocal: makeUnimplementedAdapter('dlocal'),
  airwallex: makeUnimplementedAdapter('airwallex'),
}

/**
 * Create a PSP adapter instance
 * In test mode (sk_test_*), returns TestAdapter for simulated responses
 */
export function createPSPAdapter(
  psp: PSPName,
  credentials: PSPCredentials,
  options?: { forceTestMode?: boolean; apiKey?: string }
): BasePSPAdapter {
  // Check if we should use test mode
  const useTestMode = options?.forceTestMode ||
    (options?.apiKey && isTestMode(options.apiKey)) ||
    credentials.environment === 'test'

  if (useTestMode) {
    return new TestAdapter(credentials)
  }

  const AdapterClass = adapterRegistry[psp]

  if (!AdapterClass) {
    throw new Error(`Unknown PSP: ${psp}`)
  }

  return new AdapterClass(credentials)
}

/**
 * Create test adapter directly
 */
export function createTestAdapter(): TestAdapter {
  return new TestAdapter({
    environment: 'test',
    credentials: {},
  })
}

/**
 * Get list of supported PSPs
 */
export function getSupportedPSPs(): PSPName[] {
  return Object.keys(adapterRegistry) as PSPName[]
}

/**
 * Check if a PSP is supported
 */
export function isPSPSupported(psp: string): psp is PSPName {
  return psp in adapterRegistry
}

export { BasePSPAdapter } from './base'
export { StripeAdapter } from './stripe'
export { AdyenAdapter } from './adyen'
export { TestAdapter, isTestMode, getTestCardNumbers, TEST_CARDS } from './test'
