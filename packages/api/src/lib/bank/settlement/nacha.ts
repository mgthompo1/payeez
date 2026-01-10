/**
 * NACHA File Generator
 *
 * Generates NACHA-formatted files for ACH batch processing.
 * Reference: https://achdevguide.nacha.org/
 */

import type { BankTransfer, NachaBatch, BankAccount } from '../types';
import { retrieveBankData } from '../vault';

// ============================================
// NACHA File Format Constants
// ============================================

const RECORD_SIZE = 94;
const BLOCKING_FACTOR = 10;

// Standard Entry Class Codes
export const SEC_CODES = {
  PPD: 'PPD', // Prearranged Payment and Deposit (consumer)
  CCD: 'CCD', // Corporate Credit or Debit (business)
  WEB: 'WEB', // Internet-Initiated Entry
  TEL: 'TEL', // Telephone-Initiated Entry
  CTX: 'CTX', // Corporate Trade Exchange
} as const;

export type SECCode = (typeof SEC_CODES)[keyof typeof SEC_CODES];

// Transaction Codes
export const TRANSACTION_CODES = {
  // Checking
  CHECKING_CREDIT: '22',
  CHECKING_DEBIT: '27',
  CHECKING_CREDIT_PRENOTE: '23',
  CHECKING_DEBIT_PRENOTE: '28',
  // Savings
  SAVINGS_CREDIT: '32',
  SAVINGS_DEBIT: '37',
  SAVINGS_CREDIT_PRENOTE: '33',
  SAVINGS_DEBIT_PRENOTE: '38',
} as const;

// ============================================
// NACHA Configuration
// ============================================

export interface NachaConfig {
  immediate_destination: string;      // 9 digits - Receiving bank routing
  immediate_origin: string;           // 9 digits - Your company's routing
  immediate_destination_name: string; // 23 chars max
  immediate_origin_name: string;      // 23 chars max
  company_name: string;               // 16 chars max
  company_id: string;                 // 10 chars (usually 1 + EIN)
  company_entry_description: string;  // 10 chars max
  odfi_id: string;                    // 8 digits - Originating DFI
}

// ============================================
// Helper Functions
// ============================================

function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, ' ');
}

function padLeft(str: string, len: number, char = '0'): string {
  return str.substring(0, len).padStart(len, char);
}

function formatAmount(cents: number): string {
  return padLeft(cents.toString(), 10);
}

function formatDate(date: Date): string {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatTime(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}${mm}`;
}

function generateTraceNumber(odfiId: string, sequenceNumber: number): string {
  return `${odfiId}${padLeft(sequenceNumber.toString(), 7)}`;
}

// ============================================
// Record Builders
// ============================================

/**
 * File Header Record (1)
 */
function buildFileHeader(config: NachaConfig, fileDate: Date, fileId: string): string {
  return [
    '1',                                              // Record Type Code
    '01',                                             // Priority Code
    ' ' + padLeft(config.immediate_destination, 9),   // Immediate Destination (with leading space)
    padLeft(config.immediate_origin, 10),             // Immediate Origin
    formatDate(fileDate),                             // File Creation Date
    formatTime(fileDate),                             // File Creation Time
    fileId.charAt(0).toUpperCase(),                   // File ID Modifier (A-Z, 0-9)
    '094',                                            // Record Size
    '10',                                             // Blocking Factor
    '1',                                              // Format Code
    padRight(config.immediate_destination_name, 23),  // Immediate Destination Name
    padRight(config.immediate_origin_name, 23),       // Immediate Origin Name
    padRight('', 8),                                  // Reference Code (optional)
  ].join('');
}

/**
 * Batch Header Record (5)
 */
function buildBatchHeader(
  config: NachaConfig,
  batchNumber: number,
  secCode: SECCode,
  effectiveDate: Date
): string {
  return [
    '5',                                              // Record Type Code
    '200',                                            // Service Class Code (mixed debits/credits)
    padRight(config.company_name, 16),                // Company Name
    padRight('', 20),                                 // Company Discretionary Data
    padLeft(config.company_id, 10),                   // Company Identification
    secCode,                                          // Standard Entry Class Code
    padRight(config.company_entry_description, 10),   // Company Entry Description
    padRight('', 6),                                  // Company Descriptive Date
    formatDate(effectiveDate),                        // Effective Entry Date
    '   ',                                            // Settlement Date (blank, filled by bank)
    '1',                                              // Originator Status Code
    padLeft(config.odfi_id, 8),                       // Originating DFI Identification
    padLeft(batchNumber.toString(), 7),               // Batch Number
  ].join('');
}

/**
 * Entry Detail Record (6)
 */
function buildEntryDetail(
  transfer: BankTransfer,
  bankData: { routing_number: string; account_number: string; account_type: string },
  odfiId: string,
  entrySequence: number
): string {
  // Determine transaction code
  const isDebit = transfer.direction === 'debit';
  const isChecking = bankData.account_type === 'checking';

  let transactionCode: string;
  if (isChecking) {
    transactionCode = isDebit ? TRANSACTION_CODES.CHECKING_DEBIT : TRANSACTION_CODES.CHECKING_CREDIT;
  } else {
    transactionCode = isDebit ? TRANSACTION_CODES.SAVINGS_DEBIT : TRANSACTION_CODES.SAVINGS_CREDIT;
  }

  // Routing number: 8 digits + 1 check digit
  const routingNumber = bankData.routing_number;
  const routingTransit = routingNumber.substring(0, 8);
  const checkDigit = routingNumber.charAt(8);

  return [
    '6',                                              // Record Type Code
    transactionCode,                                  // Transaction Code
    routingTransit,                                   // Receiving DFI Identification (8 digits)
    checkDigit,                                       // Check Digit
    padRight(bankData.account_number, 17),            // DFI Account Number
    formatAmount(transfer.amount),                    // Amount
    padRight(transfer.id.substring(0, 15), 15),       // Individual Identification Number
    padRight(transfer.description || '', 22),         // Individual Name
    '  ',                                             // Discretionary Data
    '0',                                              // Addenda Record Indicator
    generateTraceNumber(odfiId, entrySequence),       // Trace Number
  ].join('');
}

/**
 * Batch Control Record (8)
 */
function buildBatchControl(
  batchNumber: number,
  entryCount: number,
  entryHash: number,
  totalDebit: number,
  totalCredit: number,
  config: NachaConfig
): string {
  return [
    '8',                                              // Record Type Code
    '200',                                            // Service Class Code
    padLeft(entryCount.toString(), 6),                // Entry/Addenda Count
    padLeft((entryHash % 10000000000).toString(), 10), // Entry Hash (mod 10^10)
    formatAmount(totalDebit),                         // Total Debit Entry Dollar Amount
    formatAmount(totalCredit),                        // Total Credit Entry Dollar Amount
    padLeft(config.company_id, 10),                   // Company Identification
    padRight('', 19),                                 // Message Authentication Code
    padRight('', 6),                                  // Reserved
    padLeft(config.odfi_id, 8),                       // Originating DFI Identification
    padLeft(batchNumber.toString(), 7),               // Batch Number
  ].join('');
}

/**
 * File Control Record (9)
 */
function buildFileControl(
  batchCount: number,
  blockCount: number,
  entryAddendaCount: number,
  entryHash: number,
  totalDebit: number,
  totalCredit: number
): string {
  return [
    '9',                                              // Record Type Code
    padLeft(batchCount.toString(), 6),                // Batch Count
    padLeft(blockCount.toString(), 6),                // Block Count
    padLeft(entryAddendaCount.toString(), 8),         // Entry/Addenda Count
    padLeft((entryHash % 10000000000).toString(), 10), // Entry Hash
    formatAmount(totalDebit),                         // Total Debit Entry Dollar Amount
    formatAmount(totalCredit),                        // Total Credit Entry Dollar Amount
    padRight('', 39),                                 // Reserved
  ].join('');
}

/**
 * Blocking Record (9s)
 */
function buildBlockingRecord(): string {
  return '9'.repeat(RECORD_SIZE);
}

// ============================================
// NACHA File Generator
// ============================================

export interface NachaTransferInput {
  transfer: BankTransfer;
  bankAccount: BankAccount;
}

export interface NachaFileResult {
  content: string;
  filename: string;
  batch_count: number;
  entry_count: number;
  total_debit: number;
  total_credit: number;
  file_hash: number;
}

/**
 * Generate a NACHA file from a list of transfers.
 */
export function generateNachaFile(
  config: NachaConfig,
  transfers: NachaTransferInput[],
  secCode: SECCode = 'WEB',
  effectiveDate: Date = new Date(),
  fileId = 'A'
): NachaFileResult {
  const lines: string[] = [];
  const fileDate = new Date();

  // File Header
  lines.push(buildFileHeader(config, fileDate, fileId));

  // Process transfers into batches
  let totalDebit = 0;
  let totalCredit = 0;
  let entryHash = 0;
  let entryCount = 0;
  let batchCount = 0;

  // For simplicity, put all transfers in one batch
  // In production, you might batch by SEC code, effective date, etc.
  if (transfers.length > 0) {
    batchCount = 1;
    lines.push(buildBatchHeader(config, batchCount, secCode, effectiveDate));

    let batchDebit = 0;
    let batchCredit = 0;
    let batchHash = 0;

    for (const { transfer, bankAccount } of transfers) {
      entryCount++;

      // Decrypt bank data
      const bankData = retrieveBankData(bankAccount.vault_token);

      // Add entry
      lines.push(buildEntryDetail(transfer, bankData, config.odfi_id, entryCount));

      // Update totals
      const routingFirst8 = parseInt(bankData.routing_number.substring(0, 8), 10);
      batchHash += routingFirst8;

      if (transfer.direction === 'debit') {
        batchDebit += transfer.amount;
      } else {
        batchCredit += transfer.amount;
      }
    }

    // Batch Control
    lines.push(buildBatchControl(batchCount, entryCount, batchHash, batchDebit, batchCredit, config));

    totalDebit = batchDebit;
    totalCredit = batchCredit;
    entryHash = batchHash;
  }

  // Calculate block count
  const recordCount = lines.length + 1; // +1 for file control
  const blockCount = Math.ceil(recordCount / BLOCKING_FACTOR);
  const fillRecords = blockCount * BLOCKING_FACTOR - recordCount;

  // File Control
  lines.push(buildFileControl(batchCount, blockCount, entryCount, entryHash, totalDebit, totalCredit));

  // Blocking (fill to complete block)
  for (let i = 0; i < fillRecords; i++) {
    lines.push(buildBlockingRecord());
  }

  // Generate filename
  const dateStr = formatDate(fileDate);
  const filename = `ACH_${dateStr}_${fileId}.ach`;

  return {
    content: lines.join('\n'),
    filename,
    batch_count: batchCount,
    entry_count: entryCount,
    total_debit: totalDebit,
    total_credit: totalCredit,
    file_hash: entryHash,
  };
}

// ============================================
// Batch Management
// ============================================

export interface CreateBatchInput {
  transfers: NachaTransferInput[];
  config: NachaConfig;
  secCode?: SECCode;
  effectiveDate?: Date;
}

/**
 * Create a NACHA batch and store it in the database.
 */
export async function createNachaBatch(
  supabase: any,
  tenantId: string,
  input: CreateBatchInput
): Promise<{ batch: NachaBatch; file: NachaFileResult } | { error: string }> {
  const { transfers, config, secCode = 'WEB', effectiveDate = new Date() } = input;

  // Validate transfers
  if (transfers.length === 0) {
    return { error: 'No transfers provided' };
  }

  // Generate file
  const fileResult = generateNachaFile(config, transfers, secCode, effectiveDate);

  // Create batch record
  const { data: batch, error } = await supabase
    .from('nacha_batches')
    .insert({
      tenant_id: tenantId,
      status: 'pending',
      transfer_count: fileResult.entry_count,
      total_amount: fileResult.total_debit + fileResult.total_credit,
      file_content: fileResult.content,
      file_name: fileResult.filename,
      effective_date: effectiveDate.toISOString(),
      metadata: {
        sec_code: secCode,
        batch_count: fileResult.batch_count,
        entry_hash: fileResult.file_hash,
        total_debit: fileResult.total_debit,
        total_credit: fileResult.total_credit,
      },
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Link transfers to batch
  const transferIds = transfers.map((t) => t.transfer.id);
  await supabase
    .from('bank_transfers')
    .update({
      nacha_batch_id: batch.id,
      status: 'pending',
    })
    .in('id', transferIds);

  return { batch, file: fileResult };
}

/**
 * Mark a batch as submitted to the bank.
 */
export async function submitNachaBatch(
  supabase: any,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('nacha_batches')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Update all transfers in the batch
  await supabase
    .from('bank_transfers')
    .update({
      status: 'processing',
    })
    .eq('nacha_batch_id', batchId);

  return { success: true };
}

/**
 * Process return/acknowledgment from bank.
 */
export async function processNachaResponse(
  supabase: any,
  batchId: string,
  responseType: 'ack' | 'settled' | 'rejected',
  details?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const statusMap = {
    ack: 'acknowledged',
    settled: 'settled',
    rejected: 'rejected',
  } as const;

  const { error } = await supabase
    .from('nacha_batches')
    .update({
      status: statusMap[responseType],
      acknowledged_at: responseType === 'ack' ? new Date().toISOString() : undefined,
      settled_at: responseType === 'settled' ? new Date().toISOString() : undefined,
      metadata: details,
    })
    .eq('id', batchId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Update transfers based on response
  if (responseType === 'settled') {
    await supabase
      .from('bank_transfers')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
      })
      .eq('nacha_batch_id', batchId);
  }

  return { success: true };
}

// ============================================
// Prenote Generation (for account validation)
// ============================================

/**
 * Generate a prenote (zero-dollar test transaction) for account verification.
 */
export function generatePrenote(
  config: NachaConfig,
  bankAccount: BankAccount,
  direction: 'debit' | 'credit' = 'credit'
): NachaFileResult {
  const bankData = retrieveBankData(bankAccount.vault_token);

  const prenoteTransfer: BankTransfer = {
    id: `prenote_${bankAccount.id}`,
    tenant_id: bankAccount.tenant_id,
    bank_account_id: bankAccount.id,
    direction,
    amount: 0,
    currency: 'USD',
    status: 'pending',
    settlement_provider: 'nacha',
    description: 'PRENOTE VERIFICATION',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return generateNachaFile(
    config,
    [{ transfer: prenoteTransfer, bankAccount }],
    'PPD', // Prenotes use PPD
    new Date()
  );
}
