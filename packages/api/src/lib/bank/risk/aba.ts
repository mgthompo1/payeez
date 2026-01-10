/**
 * ABA Routing Number Validation
 *
 * Validates US bank routing numbers using the ABA checksum algorithm.
 */

// ============================================
// ABA Routing Number Validation
// ============================================

/**
 * Validates a US ABA routing number using the checksum algorithm.
 *
 * The checksum formula:
 * 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + 1(d3 + d6 + d9) mod 10 = 0
 */
export function validateABARoutingNumber(routingNumber: string): boolean {
  // Must be exactly 9 digits
  if (!/^\d{9}$/.test(routingNumber)) {
    return false;
  }

  const digits = routingNumber.split('').map(Number);

  // ABA checksum algorithm
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);

  return checksum % 10 === 0;
}

/**
 * Get the Federal Reserve district from a routing number.
 * First two digits indicate the district.
 */
export function getFederalReserveDistrict(routingNumber: string): string | null {
  if (routingNumber.length < 2) return null;

  const prefix = parseInt(routingNumber.substring(0, 2), 10);

  // Federal Reserve routing number ranges
  const districts: Record<string, string> = {
    '01-12': 'Boston',
    '21-32': 'New York',
    '31-32': 'Philadelphia',
    '41-42': 'Cleveland',
    '51-52': 'Richmond',
    '61-62': 'Atlanta',
    '71-72': 'Chicago',
    '81-82': 'St. Louis',
    '91-92': 'Minneapolis',
  };

  if (prefix >= 1 && prefix <= 12) return 'Boston';
  if (prefix >= 21 && prefix <= 32) return 'New York';
  if (prefix >= 31 && prefix <= 32) return 'Philadelphia';
  if (prefix >= 41 && prefix <= 42) return 'Cleveland';
  if (prefix >= 51 && prefix <= 52) return 'Richmond';
  if (prefix >= 61 && prefix <= 62) return 'Atlanta';
  if (prefix >= 71 && prefix <= 72) return 'Chicago';
  if (prefix >= 81 && prefix <= 82) return 'St. Louis';
  if (prefix >= 91 && prefix <= 92) return 'Minneapolis';

  return null;
}

/**
 * Validate account number format (basic checks).
 */
export function validateAccountNumber(accountNumber: string): boolean {
  // Remove spaces and hyphens
  const cleaned = accountNumber.replace(/[\s-]/g, '');

  // Must be 4-17 digits
  if (!/^\d{4,17}$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Format routing number for display (XXX-XXX-XXX).
 */
export function formatRoutingNumber(routingNumber: string): string {
  if (routingNumber.length !== 9) return routingNumber;
  return `${routingNumber.slice(0, 3)}-${routingNumber.slice(3, 6)}-${routingNumber.slice(6, 9)}`;
}

// ============================================
// UK Sort Code Validation
// ============================================

/**
 * Validates a UK sort code (6 digits, often formatted as XX-XX-XX).
 */
export function validateUKSortCode(sortCode: string): boolean {
  const cleaned = sortCode.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(cleaned);
}

/**
 * Format UK sort code for display (XX-XX-XX).
 */
export function formatUKSortCode(sortCode: string): string {
  const cleaned = sortCode.replace(/[\s-]/g, '');
  if (cleaned.length !== 6) return sortCode;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
}

// ============================================
// IBAN Validation (EU)
// ============================================

/**
 * Validates an IBAN using the MOD-97 algorithm.
 */
export function validateIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  // Basic format check: 2 letters + 2 digits + up to 30 alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) {
    return false;
  }

  // Move first 4 characters to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, etc.)
  let numericString = '';
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Perform MOD-97 check (handle large numbers)
  let remainder = 0;
  for (const char of numericString) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97;
  }

  return remainder === 1;
}

/**
 * Format IBAN for display (groups of 4).
 */
export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

// ============================================
// Australian BSB Validation
// ============================================

/**
 * Validates an Australian BSB (6 digits, formatted as XXX-XXX).
 */
export function validateAustralianBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(cleaned);
}

/**
 * Format Australian BSB for display (XXX-XXX).
 */
export function formatAustralianBSB(bsb: string): string {
  const cleaned = bsb.replace(/[\s-]/g, '');
  if (cleaned.length !== 6) return bsb;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
}

// ============================================
// New Zealand Bank Account Validation
// ============================================

/**
 * Validates a New Zealand bank account number.
 * Format: BB-bbbb-AAAAAAA-SSS (Bank-Branch-Account-Suffix)
 */
export function validateNZBankAccount(accountNumber: string): boolean {
  const cleaned = accountNumber.replace(/[\s-]/g, '');

  // Should be 15-16 digits total
  if (!/^\d{15,16}$/.test(cleaned)) {
    return false;
  }

  return true;
}

// ============================================
// Canadian Transit Number Validation
// ============================================

/**
 * Validates a Canadian transit number (5 digits) and institution number (3 digits).
 */
export function validateCanadianTransit(transit: string, institution: string): boolean {
  const cleanedTransit = transit.replace(/[\s-]/g, '');
  const cleanedInstitution = institution.replace(/[\s-]/g, '');

  return /^\d{5}$/.test(cleanedTransit) && /^\d{3}$/.test(cleanedInstitution);
}

// ============================================
// Combined Validation
// ============================================

export interface BankValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  formatted?: {
    routing: string;
    account: string;
  };
}

export function validateBankDetails(
  country: string,
  accountNumber: string,
  routingNumber: string
): BankValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let formatted: { routing: string; account: string } | undefined;

  switch (country.toUpperCase()) {
    case 'US':
      if (!validateABARoutingNumber(routingNumber)) {
        errors.push('Invalid routing number');
      }
      if (!validateAccountNumber(accountNumber)) {
        errors.push('Invalid account number');
      }
      if (errors.length === 0) {
        formatted = {
          routing: formatRoutingNumber(routingNumber),
          account: accountNumber,
        };
      }
      break;

    case 'GB':
      if (!validateUKSortCode(routingNumber)) {
        errors.push('Invalid sort code');
      }
      if (!validateAccountNumber(accountNumber)) {
        errors.push('Invalid account number');
      }
      if (errors.length === 0) {
        formatted = {
          routing: formatUKSortCode(routingNumber),
          account: accountNumber,
        };
      }
      break;

    case 'EU':
      // For EU, account number is the IBAN
      if (!validateIBAN(accountNumber)) {
        errors.push('Invalid IBAN');
      }
      if (errors.length === 0) {
        formatted = {
          routing: '',
          account: formatIBAN(accountNumber),
        };
      }
      break;

    case 'AU':
      if (!validateAustralianBSB(routingNumber)) {
        errors.push('Invalid BSB');
      }
      if (!validateAccountNumber(accountNumber)) {
        errors.push('Invalid account number');
      }
      if (errors.length === 0) {
        formatted = {
          routing: formatAustralianBSB(routingNumber),
          account: accountNumber,
        };
      }
      break;

    case 'NZ':
      if (!validateNZBankAccount(accountNumber)) {
        errors.push('Invalid bank account number');
      }
      if (errors.length === 0) {
        formatted = {
          routing: '',
          account: accountNumber,
        };
      }
      break;

    default:
      warnings.push(`Validation not implemented for country: ${country}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    formatted,
  };
}
