/**
 * Bank Account Utilities
 *
 * Validation and formatting for bank account numbers.
 */

// ABA Routing Number Validation (US)
export function validateRoutingNumber(routingNumber: string): {
  valid: boolean;
  error?: string;
} {
  // Remove any formatting
  const cleaned = routingNumber.replace(/[^0-9]/g, '');

  if (cleaned.length === 0) {
    return { valid: false, error: 'Routing number is required' };
  }

  if (cleaned.length !== 9) {
    return { valid: false, error: 'Routing number must be 9 digits' };
  }

  // ABA checksum algorithm
  const digits = cleaned.split('').map(Number);
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);

  if (checksum % 10 !== 0) {
    return { valid: false, error: 'Invalid routing number' };
  }

  return { valid: true };
}

// Format routing number with dashes (XXX-XXX-XXX)
export function formatRoutingNumber(routingNumber: string): string {
  const cleaned = routingNumber.replace(/[^0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
}

// Basic account number validation
export function validateAccountNumber(accountNumber: string): {
  valid: boolean;
  error?: string;
} {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');

  if (cleaned.length === 0) {
    return { valid: false, error: 'Account number is required' };
  }

  if (cleaned.length < 4) {
    return { valid: false, error: 'Account number too short' };
  }

  if (cleaned.length > 17) {
    return { valid: false, error: 'Account number too long' };
  }

  return { valid: true };
}

// Mask account number (show last 4 only)
export function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  if (cleaned.length <= 4) return '****';
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

// Bank name lookup from routing number prefix
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

export function getBankName(routingNumber: string): string | null {
  const cleaned = routingNumber.replace(/[^0-9]/g, '');
  if (cleaned.length < 4) return null;
  const prefix = cleaned.substring(0, 4);
  return ROUTING_PREFIXES[prefix] || null;
}

// Get Federal Reserve district from routing number
export function getFederalReserveDistrict(routingNumber: string): string | null {
  const cleaned = routingNumber.replace(/[^0-9]/g, '');
  if (cleaned.length < 2) return null;

  const prefix = parseInt(cleaned.substring(0, 2), 10);

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

// Validate IBAN (for EU)
export function validateIBAN(iban: string): { valid: boolean; error?: string } {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid IBAN format' };
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

  // Perform MOD-97 check
  let remainder = 0;
  for (const char of numericString) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, error: 'Invalid IBAN checksum' };
  }

  return { valid: true };
}

// Format IBAN for display (groups of 4)
export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

// Validate UK sort code
export function validateSortCode(sortCode: string): { valid: boolean; error?: string } {
  const cleaned = sortCode.replace(/[^0-9]/g, '');
  if (cleaned.length !== 6) {
    return { valid: false, error: 'Sort code must be 6 digits' };
  }
  return { valid: true };
}

// Format UK sort code (XX-XX-XX)
export function formatSortCode(sortCode: string): string {
  const cleaned = sortCode.replace(/[^0-9]/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
}
