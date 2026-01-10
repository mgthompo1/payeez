/**
 * Bank Account Vault Integration
 *
 * Secure storage of bank account numbers using Atlas vault abstraction.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type {
  BankAccount,
  BankAccountCreateInput,
  BankAccountVaultData,
  BankCountry,
} from './types';

// ============================================
// Encryption (AES-256-GCM)
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = Deno.env.get('BANK_VAULT_KEY') || Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!key) {
    throw new Error('BANK_VAULT_KEY or VAULT_ENCRYPTION_KEY environment variable is required');
  }
  // Ensure key is 32 bytes for AES-256
  return createHash('sha256').update(key).digest();
}

export function encryptBankData(data: BankAccountVaultData): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decryptBankData(vaultToken: string): BankAccountVaultData {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, encrypted] = vaultToken.split(':');

  if (!ivB64 || !authTagB64 || !encrypted) {
    throw new Error('Invalid vault token format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ============================================
// Hashing (for duplicate detection)
// ============================================

export function hashRoutingNumber(routingNumber: string): string {
  const salt = Deno.env.get('BANK_HASH_SALT') || 'atlas-bank-hash';
  return createHash('sha256')
    .update(`${salt}:routing:${routingNumber}`)
    .digest('hex');
}

export function hashAccountNumber(accountNumber: string, routingNumber: string): string {
  const salt = Deno.env.get('BANK_HASH_SALT') || 'atlas-bank-hash';
  return createHash('sha256')
    .update(`${salt}:account:${routingNumber}:${accountNumber}`)
    .digest('hex');
}

// ============================================
// Vault Token Generation
// ============================================

export function generateVaultToken(): string {
  return `ba_vault_${randomBytes(24).toString('hex')}`;
}

// ============================================
// Bank Account Creation
// ============================================

export interface VaultedBankAccount {
  vault_token: string;
  last4: string;
  routing_last4: string;
  routing_hash: string;
  account_hash: string;
  bank_name?: string;
}

export function vaultBankAccount(input: BankAccountCreateInput): VaultedBankAccount {
  const { account_number, routing_number, holder_name, account_type } = input;

  // Validate inputs
  if (!account_number || account_number.length < 4) {
    throw new Error('Invalid account number');
  }
  if (!routing_number || routing_number.length !== 9) {
    throw new Error('Invalid routing number - must be 9 digits');
  }

  // Encrypt the sensitive data
  const vaultData: BankAccountVaultData = {
    account_number,
    routing_number,
    holder_name,
    account_type: account_type || 'checking',
  };

  const vault_token = encryptBankData(vaultData);

  // Generate hashes for duplicate detection
  const routing_hash = hashRoutingNumber(routing_number);
  const account_hash = hashAccountNumber(account_number, routing_number);

  // Look up bank name from routing number (first 4 digits identify the Federal Reserve district)
  const bank_name = lookupBankName(routing_number);

  return {
    vault_token,
    last4: account_number.slice(-4),
    routing_last4: routing_number.slice(-4),
    routing_hash,
    account_hash,
    bank_name,
  };
}

// ============================================
// Bank Name Lookup (basic)
// ============================================

const ROUTING_PREFIXES: Record<string, string> = {
  '0110': 'Bank of America',
  '0210': 'JPMorgan Chase',
  '0260': 'Bank of America',
  '0310': 'PNC Bank',
  '0410': 'KeyBank',
  '0440': 'Fifth Third Bank',
  '0610': 'Regions Bank',
  '0710': 'U.S. Bank',
  '0910': 'Wells Fargo',
  '1010': 'Wells Fargo',
  '1110': 'Capital One',
  '1210': 'Citibank',
  '1220': 'HSBC',
  '3220': 'Chase',
  '3250': 'TD Bank',
};

function lookupBankName(routingNumber: string): string | undefined {
  const prefix = routingNumber.substring(0, 4);
  return ROUTING_PREFIXES[prefix];
}

// ============================================
// Retrieve Bank Data
// ============================================

export function retrieveBankData(vault_token: string): BankAccountVaultData {
  return decryptBankData(vault_token);
}

// ============================================
// Mask Account Number
// ============================================

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) {
    return '****';
  }
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

export function maskRoutingNumber(routingNumber: string): string {
  return '*****' + routingNumber.slice(-4);
}

// ============================================
// Country-specific formatting
// ============================================

export interface FormattedBankAccount {
  display: string;
  masked_account: string;
  masked_routing: string;
}

export function formatBankAccount(
  country: BankCountry,
  accountNumber: string,
  routingNumber: string
): FormattedBankAccount {
  switch (country) {
    case 'US':
      return {
        display: `****${accountNumber.slice(-4)} (Routing: ****${routingNumber.slice(-4)})`,
        masked_account: maskAccountNumber(accountNumber),
        masked_routing: maskRoutingNumber(routingNumber),
      };
    case 'GB':
      // UK: Sort code (6 digits) + Account (8 digits)
      return {
        display: `****${accountNumber.slice(-4)} (Sort: **-**-${routingNumber.slice(-2)})`,
        masked_account: maskAccountNumber(accountNumber),
        masked_routing: `**-**-${routingNumber.slice(-2)}`,
      };
    case 'EU':
      // IBAN format
      return {
        display: `****${accountNumber.slice(-4)}`,
        masked_account: maskAccountNumber(accountNumber),
        masked_routing: '', // IBAN includes routing info
      };
    case 'AU':
      // BSB (6 digits) + Account
      return {
        display: `****${accountNumber.slice(-4)} (BSB: ***-${routingNumber.slice(-3)})`,
        masked_account: maskAccountNumber(accountNumber),
        masked_routing: `***-${routingNumber.slice(-3)}`,
      };
    case 'NZ':
    case 'CA':
    default:
      return {
        display: `****${accountNumber.slice(-4)}`,
        masked_account: maskAccountNumber(accountNumber),
        masked_routing: routingNumber ? maskRoutingNumber(routingNumber) : '',
      };
  }
}
