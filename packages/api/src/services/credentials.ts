// ============================================
// Credential Management Service
// Handles secure storage of PSP credentials
// ============================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type { PSPName, PSPCredentials } from '../types'

interface EncryptedCredential {
  id: string
  tenant_id: string
  psp: PSPName
  environment: 'test' | 'live'
  encrypted_data: string
  iv: string
  created_at: string
  updated_at: string
}

interface CredentialManagerConfig {
  encryptionKey: string // Base64 encoded 32-byte key
  // Optional: AWS KMS key ARN for production
  kmsKeyArn?: string
}

export class CredentialManager {
  private config: CredentialManagerConfig
  private key: Buffer

  constructor(config: CredentialManagerConfig) {
    this.config = config
    // Derive a proper key from the provided key
    this.key = scryptSync(config.encryptionKey, 'atlas-salt', 32)
  }

  /**
   * Encrypt credentials for storage
   */
  encrypt(credentials: PSPCredentials): { encrypted: string; iv: string } {
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)

    const json = JSON.stringify(credentials)
    let encrypted = cipher.update(json, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    // Append auth tag
    const authTag = cipher.getAuthTag()
    const combined = Buffer.concat([
      Buffer.from(encrypted, 'base64'),
      authTag,
    ])

    return {
      encrypted: combined.toString('base64'),
      iv: iv.toString('base64'),
    }
  }

  /**
   * Decrypt credentials from storage
   */
  decrypt(encrypted: string, iv: string): PSPCredentials {
    const ivBuffer = Buffer.from(iv, 'base64')
    const combined = Buffer.from(encrypted, 'base64')

    // Split encrypted data and auth tag
    const authTag = combined.slice(-16)
    const encryptedData = combined.slice(0, -16)

    const decipher = createDecipheriv('aes-256-gcm', this.key, ivBuffer)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return JSON.parse(decrypted)
  }

  /**
   * Validate credential format for a PSP
   */
  validateCredentials(psp: PSPName, credentials: PSPCredentials): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Common validation
    if (!credentials.environment || !['test', 'live'].includes(credentials.environment)) {
      errors.push('Environment must be "test" or "live"')
    }

    // PSP-specific validation
    switch (psp) {
      case 'stripe':
        if (!credentials.api_key) {
          errors.push('API key is required for Stripe')
        } else if (!credentials.api_key.startsWith('sk_')) {
          errors.push('Stripe API key must start with "sk_"')
        }
        break

      case 'adyen':
        if (!credentials.api_key) {
          errors.push('API key is required for Adyen')
        }
        if (!credentials.merchant_id) {
          errors.push('Merchant account is required for Adyen')
        }
        break

      case 'authorizenet':
        if (!credentials.api_login_id || !credentials.transaction_key) {
          errors.push('API login ID and transaction key are required for Authorize.net')
        }
        break

      case 'braintree':
        if (!credentials.merchant_id || !credentials.public_key || !credentials.api_key) {
          errors.push('Merchant ID, public key, and private key are required for Braintree')
        }
        break

      case 'checkoutcom':
        if (!credentials.api_key) {
          errors.push('Secret key is required for Checkout.com')
        }
        if (!credentials.public_key) {
          errors.push('Public key is required for Checkout.com')
        }
        break

      case 'chase':
        if (
          !credentials.orbital_connection_username ||
          !credentials.orbital_connection_password ||
          !credentials.merchant_id ||
          !credentials.terminal_id
        ) {
          errors.push('Orbital username/password, merchant ID, and terminal ID are required for Chase')
        }
        break

      default:
        if (!credentials.api_key) {
          errors.push('API key is required')
        }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Mask sensitive credential fields for display
   */
  maskCredentials(credentials: PSPCredentials): Record<string, string> {
    const masked: Record<string, string> = {}

    for (const [key, value] of Object.entries(credentials)) {
      if (!value || typeof value !== 'string') {
        masked[key] = value as string
        continue
      }

      if (key === 'environment') {
        masked[key] = value
        continue
      }

      // Mask sensitive values, showing only first and last 4 chars
      if (value.length > 12) {
        masked[key] = `${value.slice(0, 4)}...${value.slice(-4)}`
      } else if (value.length > 4) {
        masked[key] = `${value.slice(0, 2)}...${value.slice(-2)}`
      } else {
        masked[key] = '****'
      }
    }

    return masked
  }

  /**
   * Generate a test credential set for sandbox mode
   */
  generateTestCredentials(psp: PSPName): PSPCredentials {
    const testCreds: Record<PSPName, PSPCredentials> = {
      stripe: {
        api_key: 'sk_test_xxxxxxxxxxxxxxxxxxxxx',
        public_key: 'pk_test_xxxxxxxxxxxxxxxxxxxxx',
        environment: 'test',
      },
      adyen: {
        api_key: 'AQE....test',
        merchant_id: 'TestMerchant',
        environment: 'test',
      },
      authorizenet: {
        api_login_id: 'test_login',
        transaction_key: 'test_key',
        environment: 'test',
      },
      braintree: {
        merchant_id: 'test_merchant',
        public_key: 'test_public',
        api_key: 'test_private',
        environment: 'test',
      },
      checkoutcom: {
        api_key: 'sk_test_xxx',
        public_key: 'pk_test_xxx',
        environment: 'test',
      },
      chase: {
        orbital_connection_username: 'test_user',
        orbital_connection_password: 'test_pass',
        merchant_id: 'test_merchant',
        terminal_id: 'test_terminal',
        environment: 'test',
      },
      nuvei: {
        merchant_id: 'test',
        api_key: 'test',
        api_secret: 'test',
        environment: 'test',
      },
      dlocal: {
        api_key: 'test',
        api_secret: 'test',
        environment: 'test',
      },
      airwallex: {
        api_key: 'test',
        api_secret: 'test',
        environment: 'test',
      },
    }

    return testCreds[psp]
  }
}

/**
 * Credential requirements for each PSP
 */
export const PSP_CREDENTIAL_FIELDS: Record<PSPName, Array<{
  key: string
  label: string
  required: boolean
  sensitive: boolean
  placeholder?: string
}>> = {
  stripe: [
    { key: 'api_key', label: 'Secret Key', required: true, sensitive: true, placeholder: 'sk_live_...' },
    { key: 'public_key', label: 'Publishable Key', required: false, sensitive: false, placeholder: 'pk_live_...' },
    { key: 'webhook_secret', label: 'Webhook Signing Secret', required: false, sensitive: true, placeholder: 'whsec_...' },
  ],
  adyen: [
    { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    { key: 'merchant_id', label: 'Merchant Account', required: true, sensitive: false },
    { key: 'webhook_secret', label: 'HMAC Key', required: false, sensitive: true },
  ],
  authorizenet: [
    { key: 'api_login_id', label: 'API Login ID', required: true, sensitive: false },
    { key: 'transaction_key', label: 'Transaction Key', required: true, sensitive: true },
  ],
  braintree: [
    { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
    { key: 'public_key', label: 'Public Key', required: true, sensitive: false },
    { key: 'api_key', label: 'Private Key', required: true, sensitive: true },
  ],
  checkoutcom: [
    { key: 'api_key', label: 'Secret Key', required: true, sensitive: true, placeholder: 'sk_...' },
    { key: 'public_key', label: 'Public Key', required: true, sensitive: false, placeholder: 'pk_...' },
  ],
  chase: [
    { key: 'orbital_connection_username', label: 'Orbital Username', required: true, sensitive: false },
    { key: 'orbital_connection_password', label: 'Orbital Password', required: true, sensitive: true },
    { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
    { key: 'terminal_id', label: 'Terminal ID', required: true, sensitive: false },
  ],
  nuvei: [
    { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
    { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    { key: 'api_secret', label: 'Secret Key', required: true, sensitive: true },
  ],
  dlocal: [
    { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    { key: 'api_secret', label: 'Secret Key', required: true, sensitive: true },
  ],
  airwallex: [
    { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    { key: 'api_secret', label: 'Client Secret', required: true, sensitive: true },
  ],
}
