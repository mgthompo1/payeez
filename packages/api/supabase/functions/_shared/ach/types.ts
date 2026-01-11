/**
 * ACH Settlement Adapter Types
 *
 * Common interfaces for multi-rail ACH processing:
 * - Stripe ACH (PaymentIntents + us_bank_account)
 * - Moov (faster ACH)
 * - PayPal ACH
 * - Traditional NACHA files
 */

// Settlement provider names (matches database enum)
export type ACHProviderName = 'stripe_ach' | 'moov' | 'paypal_ach' | 'nacha' | 'dwolla' | 'open_banking';

// ACH transfer direction
export type ACHDirection = 'debit' | 'credit';

// ACH attempt status (matches database CHECK constraint)
export type ACHAttemptStatus =
  | 'pending'      // Created, not yet submitted
  | 'submitted'    // Sent to provider
  | 'processing'   // Provider is processing
  | 'settled'      // Funds moved successfully
  | 'failed'       // Failed (pre-settlement)
  | 'returned'     // Returned (post-settlement, ACH return)
  | 'canceled';    // Canceled before settlement

// Verification methods
export type VerificationMethod = 'micro_deposits' | 'financial_connections' | 'instant' | 'manual';
export type VerificationStrength = 'basic' | 'strong';

// Bank account details for settlement
export interface ACHBankAccount {
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  accountHolderName: string;
  accountHolderType: 'individual' | 'company';
}

// Mandate details for NACHA compliance
export interface ACHMandate {
  id: string;
  authorizationText: string;
  acceptedAt: string;
  ipAddress: string;
  userAgent?: string;
  // For audit/disputes
  textVersion?: string;
  signatureType?: 'checkbox' | 'typed_name' | 'esignature';
}

// Request to settle an ACH transfer
export interface ACHSettlementRequest {
  transferId: string;
  bankAccount: ACHBankAccount;
  amount: number;  // cents
  currency: string;
  direction: ACHDirection;
  mandate?: ACHMandate;
  idempotencyKey: string;
  description?: string;
  statementDescriptor?: string;
  metadata?: Record<string, string>;
  // For credits: destination account details
  destinationAccount?: ACHBankAccount;
}

// Response from settlement attempt
export interface ACHSettlementResponse {
  success: boolean;
  status: ACHAttemptStatus | 'requires_verification';
  providerId: string;
  estimatedSettlementAt?: string;
  // Failure details
  failureCode?: string;
  failureMessage?: string;
  failureCategory?: 'account_error' | 'bank_error' | 'network_error' | 'validation_error' | 'provider_error';
  // ACH return details (if returned)
  returnCode?: string;
  returnReason?: string;
  // Raw provider response
  rawResponse: unknown;
}

// Verification initiation response
export interface ACHVerificationResponse {
  success: boolean;
  method: VerificationMethod;
  strength: VerificationStrength;
  // For micro-deposits
  amounts?: [number, number];
  expiresAt?: string;
  // For Financial Connections / Open Banking
  sessionUrl?: string;
  sessionId?: string;
  // For instant verification
  verifiedAt?: string;
  // Provider reference
  providerRef?: string;
  // Error details
  error?: string;
}

// Verification completion request
export interface ACHVerifyRequest {
  bankAccountId: string;
  method: VerificationMethod;
  // For micro-deposits
  amounts?: [number, number];
  // For Financial Connections
  sessionId?: string;
}

/**
 * ACH Adapter Interface
 *
 * Each settlement provider implements this interface.
 * The orchestrator selects which adapter to use based on:
 * - Cost
 * - Speed (same-day ACH, next-day, standard)
 * - Verification requirements
 * - Risk profile
 */
export interface ACHAdapter {
  /** Provider identifier */
  name: ACHProviderName;

  /**
   * Debit: Pull funds from customer's bank account
   * Requires valid mandate for NACHA compliance
   */
  debit(
    req: ACHSettlementRequest,
    credentials: Record<string, string>
  ): Promise<ACHSettlementResponse>;

  /**
   * Credit: Push funds to external bank account
   * For payouts, refunds, disbursements
   */
  credit(
    req: ACHSettlementRequest,
    credentials: Record<string, string>
  ): Promise<ACHSettlementResponse>;

  /**
   * Initiate bank account verification
   * Returns verification method and any required user action
   */
  initiateVerification(
    bankAccount: ACHBankAccount,
    credentials: Record<string, string>,
    options?: {
      preferredMethod?: VerificationMethod;
      redirectUrl?: string;
    }
  ): Promise<ACHVerificationResponse>;

  /**
   * Complete verification (for micro-deposits)
   * Returns true if verification successful
   */
  verifyMicroDeposits(
    bankAccountId: string,
    amounts: [number, number],
    credentials: Record<string, string>
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Check verification status (for async methods)
   */
  checkVerificationStatus?(
    providerRef: string,
    credentials: Record<string, string>
  ): Promise<{
    status: 'pending' | 'verified' | 'failed';
    verifiedAt?: string;
    error?: string;
  }>;

  /**
   * Get settlement estimate
   */
  getSettlementEstimate?(
    direction: ACHDirection,
    amount: number
  ): {
    estimatedDays: number;
    sameDayEligible: boolean;
    cutoffTime?: string;
  };
}

// ACH return codes (NACHA standard)
export const ACH_RETURN_CODES: Record<string, { reason: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
  'R01': { reason: 'Insufficient funds', severity: 'medium' },
  'R02': { reason: 'Account closed', severity: 'high' },
  'R03': { reason: 'No account/unable to locate account', severity: 'high' },
  'R04': { reason: 'Invalid account number', severity: 'high' },
  'R05': { reason: 'Unauthorized debit to consumer account', severity: 'critical' },
  'R06': { reason: 'Returned per ODFI request', severity: 'low' },
  'R07': { reason: 'Authorization revoked by customer', severity: 'critical' },
  'R08': { reason: 'Payment stopped', severity: 'medium' },
  'R09': { reason: 'Uncollected funds', severity: 'medium' },
  'R10': { reason: 'Customer advises not authorized', severity: 'critical' },
  'R11': { reason: 'Check truncation entry return', severity: 'low' },
  'R12': { reason: 'Account sold to another DFI', severity: 'medium' },
  'R13': { reason: 'Invalid ACH routing number', severity: 'high' },
  'R14': { reason: 'Representative payee deceased', severity: 'high' },
  'R15': { reason: 'Beneficiary or account holder deceased', severity: 'high' },
  'R16': { reason: 'Account frozen', severity: 'high' },
  'R17': { reason: 'File record edit criteria', severity: 'low' },
  'R20': { reason: 'Non-transaction account', severity: 'high' },
  'R21': { reason: 'Invalid company identification', severity: 'medium' },
  'R22': { reason: 'Invalid individual ID number', severity: 'medium' },
  'R23': { reason: 'Credit entry refused by receiver', severity: 'medium' },
  'R24': { reason: 'Duplicate entry', severity: 'low' },
  'R29': { reason: 'Corporate customer advises not authorized', severity: 'critical' },
  'R31': { reason: 'Permissible return entry (CCD/CTX only)', severity: 'medium' },
  'R33': { reason: 'Return of XCK entry', severity: 'low' },
};

// Helper to get return severity
export function getReturnSeverity(returnCode: string): 'low' | 'medium' | 'high' | 'critical' {
  return ACH_RETURN_CODES[returnCode]?.severity || 'medium';
}

// Helper to check if return indicates fraud/unauthorized
export function isUnauthorizedReturn(returnCode: string): boolean {
  return ['R05', 'R07', 'R10', 'R29'].includes(returnCode);
}
