/**
 * Atlas Bank Account Types
 *
 * Core types for A2A payments, ACH, and bank account management.
 */

// ============================================
// Enums
// ============================================

export type BankVerificationMethod =
  | 'manual'        // Trust-based, B2B
  | 'microdeposit'  // Two small deposits
  | 'instant'       // Plaid/Finicity
  | 'open_banking'; // UK/EU/NZ Open Banking

export type BankVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed';

export type BankAccountType = 'checking' | 'savings';

export type MandateAuthType = 'debit' | 'credit' | 'both';

export type MandateFrequency = 'once' | 'recurring';

export type MandateStatus = 'active' | 'revoked' | 'expired';

export type TransferDirection = 'debit' | 'credit';

export type TransferStatus =
  | 'pending'
  | 'processing'
  | 'settled'
  | 'failed'
  | 'returned';

export type SettlementProvider =
  | 'nacha'         // File-based ACH
  | 'stripe_ach'    // Stripe ACH
  | 'dwolla'        // Dwolla API
  | 'moov'          // Moov API
  | 'open_banking'; // UK/EU push payments

export type BankCountry = 'US' | 'GB' | 'NZ' | 'EU' | 'AU' | 'CA';

// ============================================
// Bank Account
// ============================================

export interface BankAccount {
  id: string;
  tenant_id: string;
  customer_id?: string;

  // Display info
  holder_name: string;
  account_type: BankAccountType;
  last4: string;
  routing_last4?: string;
  bank_name?: string;

  // Vault reference
  vault_token: string;

  // Country/rail info
  country: BankCountry;
  currency: string;

  // Verification
  verification_method: BankVerificationMethod;
  verification_status: BankVerificationStatus;
  verified_at?: string;

  // Status
  is_active: boolean;
  is_default: boolean;

  // Metadata
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

export interface BankAccountCreateInput {
  customer_id?: string;
  holder_name: string;
  account_type?: BankAccountType;
  account_number: string;
  routing_number: string;
  country?: BankCountry;
  currency?: string;
  verification_method?: BankVerificationMethod;
  metadata?: Record<string, unknown>;
}

export interface BankAccountVaultData {
  account_number: string;
  routing_number: string;
  holder_name: string;
  account_type: BankAccountType;
}

// ============================================
// Bank Mandate
// ============================================

export interface BankMandate {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  customer_id?: string;

  // Authorization
  authorization_type: MandateAuthType;
  frequency: MandateFrequency;

  // Limits
  amount_limit?: number;
  daily_limit?: number;
  monthly_limit?: number;

  // Legal proof
  authorization_text: string;
  text_version: string;
  accepted_at: string;
  ip_address: string;
  user_agent?: string;

  // Status
  status: MandateStatus;
  revoked_at?: string;
  revoked_reason?: string;
  expires_at?: string;

  // Links
  subscription_id?: string;

  // Metadata
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

export interface MandateCreateInput {
  bank_account_id: string;
  customer_id?: string;
  authorization_type?: MandateAuthType;
  frequency?: MandateFrequency;
  amount_limit?: number;
  daily_limit?: number;
  monthly_limit?: number;
  authorization_text: string;
  ip_address: string;
  user_agent?: string;
  subscription_id?: string;
  metadata?: Record<string, unknown>;
}

// Default mandate text
export const DEFAULT_MANDATE_TEXT = {
  debit: `By providing your bank account information and clicking "Authorize", you authorize us to debit your bank account for payments in accordance with the terms of service. You can revoke this authorization at any time by contacting us.`,
  credit: `By providing your bank account information and clicking "Authorize", you authorize us to credit your bank account for payouts in accordance with the terms of service.`,
  both: `By providing your bank account information and clicking "Authorize", you authorize us to debit and credit your bank account for payments and payouts in accordance with the terms of service. You can revoke this authorization at any time by contacting us.`,
};

// ============================================
// Bank Transfer
// ============================================

export interface BankTransfer {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  mandate_id?: string;
  customer_id?: string;

  // Transfer details
  direction: TransferDirection;
  amount: number;
  currency: string;

  // Settlement
  settlement_provider: SettlementProvider;
  settlement_reference?: string;

  // Status
  status: TransferStatus;
  status_detail?: string;

  // Timing
  initiated_at: string;
  submitted_at?: string;
  expected_settlement_at?: string;
  settled_at?: string;
  failed_at?: string;
  returned_at?: string;

  // Return info
  return_code?: string;
  return_reason?: string;

  // NACHA info
  nacha_batch_id?: string;
  nacha_trace_number?: string;

  // Risk
  risk_score?: number;
  risk_flags: string[];

  // Descriptions
  statement_descriptor?: string;
  internal_description?: string;

  // Links
  invoice_id?: string;
  subscription_id?: string;

  // Metadata
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

export interface TransferCreateInput {
  bank_account_id: string;
  mandate_id?: string;
  customer_id?: string;
  direction: TransferDirection;
  amount: number;
  currency?: string;
  settlement_provider?: SettlementProvider;
  statement_descriptor?: string;
  internal_description?: string;
  invoice_id?: string;
  subscription_id?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// NACHA Types
// ============================================

export interface NachaBatch {
  id: string;
  tenant_id: string;
  batch_number: number;
  file_id: string;
  total_debits: number;
  total_credits: number;
  debit_amount: number;
  credit_amount: number;
  status: 'pending' | 'generated' | 'submitted' | 'processed';
  generated_at?: string;
  submitted_at?: string;
  processed_at?: string;
  file_content?: string;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface NachaFileHeader {
  immediateDestination: string;      // Receiving bank routing (10 chars, padded)
  immediateOrigin: string;           // Originator ID (10 chars)
  fileCreationDate: string;          // YYMMDD
  fileCreationTime: string;          // HHMM
  fileIdModifier: string;            // A-Z, 0-9
  recordSize: '094';                 // Fixed
  blockingFactor: '10';              // Fixed
  formatCode: '1';                   // Fixed
  immediateDestinationName: string;  // Bank name (23 chars)
  immediateOriginName: string;       // Company name (23 chars)
  referenceCode: string;             // Optional (8 chars)
}

export interface NachaBatchHeader {
  serviceClassCode: '200' | '220' | '225'; // 200=mixed, 220=credits, 225=debits
  companyName: string;                      // 16 chars
  companyDiscretionaryData: string;         // 20 chars
  companyIdentification: string;            // 10 chars (Tax ID)
  standardEntryClassCode: 'PPD' | 'CCD' | 'WEB' | 'TEL';
  companyEntryDescription: string;          // 10 chars (e.g., "PAYMENT")
  companyDescriptiveDate: string;           // 6 chars
  effectiveEntryDate: string;               // YYMMDD
  settlementDate: string;                   // Julian date (3 chars)
  originatorStatusCode: '1';                // Fixed
  originatingDFIIdentification: string;     // First 8 of routing
  batchNumber: number;
}

export interface NachaEntryDetail {
  transactionCode: string;           // 22=checking credit, 27=checking debit, etc.
  receivingDFIIdentification: string; // First 8 of routing
  checkDigit: string;                // Last digit of routing
  dfiAccountNumber: string;          // Account number (17 chars)
  amount: number;                    // In cents
  individualIdentificationNumber: string; // Customer ID (15 chars)
  individualName: string;            // 22 chars
  discretionaryData: string;         // 2 chars
  addendaRecordIndicator: '0' | '1';
  traceNumber: string;               // 15 chars
}

// ============================================
// Micro-deposit Verification
// ============================================

export interface MicrodepositVerification {
  bank_account_id: string;
  amount_1: number;  // In cents (1-99)
  amount_2: number;  // In cents (1-99)
  sent_at: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
}

export interface MicrodepositVerifyInput {
  bank_account_id: string;
  amount_1: number;
  amount_2: number;
}

// ============================================
// Settlement Config
// ============================================

export interface SettlementConfig {
  id: string;
  tenant_id: string;
  provider: SettlementProvider;
  is_default: boolean;
  is_active: boolean;

  // Provider-specific
  config: Record<string, unknown>;

  // NACHA originator info
  company_name?: string;
  company_id?: string;
  odfi_routing?: string;
  odfi_name?: string;

  // Stripe
  stripe_account_id?: string;

  // Dwolla
  dwolla_account_id?: string;
  dwolla_funding_source_id?: string;

  created_at: string;
  updated_at: string;
}

// ============================================
// Risk Types
// ============================================

export interface RiskCheckResult {
  passed: boolean;
  score: number;
  flags: string[];
  details: Record<string, unknown>;
}

export interface VelocityCheck {
  daily_count: number;
  daily_amount: number;
  monthly_count: number;
  monthly_amount: number;
  daily_limit_count?: number;
  daily_limit_amount?: number;
  monthly_limit_count?: number;
  monthly_limit_amount?: number;
}

// ACH Return Codes
export const ACH_RETURN_CODES: Record<string, { description: string; action: string }> = {
  R01: { description: 'Insufficient Funds', action: 'retry' },
  R02: { description: 'Account Closed', action: 'disable_account' },
  R03: { description: 'No Account/Unable to Locate', action: 'disable_account' },
  R04: { description: 'Invalid Account Number', action: 'disable_account' },
  R05: { description: 'Unauthorized Debit', action: 'review' },
  R06: { description: 'Returned per ODFI Request', action: 'review' },
  R07: { description: 'Authorization Revoked', action: 'revoke_mandate' },
  R08: { description: 'Payment Stopped', action: 'review' },
  R09: { description: 'Uncollected Funds', action: 'retry' },
  R10: { description: 'Customer Advises Not Authorized', action: 'review' },
  R11: { description: 'Check Truncation Entry Return', action: 'review' },
  R12: { description: 'Branch Sold to Another DFI', action: 'update_routing' },
  R13: { description: 'Invalid ACH Routing Number', action: 'disable_account' },
  R14: { description: 'Representative Payee Deceased', action: 'disable_account' },
  R15: { description: 'Beneficiary or Account Holder Deceased', action: 'disable_account' },
  R16: { description: 'Account Frozen', action: 'disable_account' },
  R17: { description: 'File Record Edit Criteria', action: 'review' },
  R20: { description: 'Non-Transaction Account', action: 'disable_account' },
  R21: { description: 'Invalid Company Identification', action: 'review' },
  R22: { description: 'Invalid Individual ID Number', action: 'review' },
  R23: { description: 'Credit Entry Refused by Receiver', action: 'review' },
  R24: { description: 'Duplicate Entry', action: 'review' },
  R29: { description: 'Corporate Customer Advises Not Authorized', action: 'review' },
  R31: { description: 'Permissible Return Entry', action: 'review' },
  R33: { description: 'Return of XCK Entry', action: 'review' },
};

// ============================================
// Country-specific Rail Config
// ============================================

export interface RailConfig {
  capture: 'account_routing' | 'open_banking_consent' | 'iban';
  verification: BankVerificationMethod[];
  settlement: SettlementProvider[];
  pull_debits: boolean;
  currency: string;
  settlement_days: number;
}

export const BANK_RAILS: Record<BankCountry, RailConfig> = {
  US: {
    capture: 'account_routing',
    verification: ['microdeposit', 'manual', 'instant'],
    settlement: ['nacha', 'stripe_ach', 'dwolla', 'moov'],
    pull_debits: true,
    currency: 'USD',
    settlement_days: 3,
  },
  GB: {
    capture: 'account_routing', // Sort code + account
    verification: ['open_banking', 'manual'],
    settlement: ['open_banking'],
    pull_debits: false, // Push-only via Open Banking
    currency: 'GBP',
    settlement_days: 0, // Faster Payments = instant
  },
  NZ: {
    capture: 'account_routing',
    verification: ['manual', 'open_banking'],
    settlement: ['nacha'], // NZ uses similar batch format
    pull_debits: true,
    currency: 'NZD',
    settlement_days: 2,
  },
  EU: {
    capture: 'iban',
    verification: ['open_banking', 'manual'],
    settlement: ['open_banking'],
    pull_debits: true, // SEPA Direct Debit
    currency: 'EUR',
    settlement_days: 1, // SEPA Instant
  },
  AU: {
    capture: 'account_routing', // BSB + account
    verification: ['manual', 'microdeposit'],
    settlement: ['nacha'], // BECS uses similar format
    pull_debits: true,
    currency: 'AUD',
    settlement_days: 2,
  },
  CA: {
    capture: 'account_routing', // Transit + institution + account
    verification: ['manual', 'microdeposit'],
    settlement: ['nacha'], // EFT uses similar format
    pull_debits: true,
    currency: 'CAD',
    settlement_days: 2,
  },
};
