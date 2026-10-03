// Shared validation used across every form in the app, matching the
// backend validators exactly (apps/accounts/models.py egypt_mobile_regex
// / name_regex) so the user gets instant feedback instead of waiting for
// a server round-trip to find out a field was invalid.

// Egyptian mobile numbers: exactly 11 digits, starting with 010/011/012/015.
export const EGYPT_PHONE_REGEX = /^(010|011|012|015)\d{8}$/;

// Names: letters (English or Arabic) + spaces/apostrophes/hyphens only -
// no digits or stray symbols, to catch typos like "Ahmed2" or "12John".
export const NAME_REGEX = /^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s'-]*$/;

export function validatePhone(value: string): string | null {
  if (!value) return null; // let required-field checks handle empty separately
  if (!/^\d*$/.test(value)) return 'Phone number must contain digits only';
  if (!EGYPT_PHONE_REGEX.test(value)) return 'Must be 11 digits starting with 010, 011, 012, or 015';
  return null;
}

export function validateName(value: string): string | null {
  if (!value) return null;
  if (!NAME_REGEX.test(value)) return 'Name must contain letters only (no numbers or symbols)';
  return null;
}

export function validateAmount(value: string): string | null {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'Amount must be a valid number (digits only)';
  return null;
}

// Input-level filters: strip disallowed characters as the user types,
// rather than only complaining after the fact.
export function digitsOnlyFilter(value: string): string {
  return value.replace(/\D/g, '');
}

export function amountFilter(value: string): string {
  // digits + at most one decimal point, up to 2 decimal places
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

// FIX: local Egyptian numbers (010XXXXXXXX) don't work with wa.me links,
// which need international format with no leading 0 (20XXXXXXXXXX).
export function toWhatsAppNumber(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, '');
  return digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
}

export function nameFilter(value: string): string {
  return value.replace(/[^A-Za-z\u0600-\u06FF\s'-]/g, '');
}

