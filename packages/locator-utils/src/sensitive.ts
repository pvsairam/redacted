/**
 * Sensitive field detector and masker.
 *
 * Privacy policy:
 * - Passwords, tokens, secrets, OTPs, SSNs, credit cards, and API keys
 *   are NEVER recorded in plain text.
 * - The value is replaced with '[REDACTED]' before being sent to the backend.
 * - The detection is conservative — when in doubt, mask.
 *
 * What we intentionally DO NOT capture:
 * - input[type="password"]
 * - Fields with names matching sensitive patterns
 * - Fields with labels matching sensitive patterns
 */

const SENSITIVE_INPUT_TYPES = new Set(['password', 'hidden']);

const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /otp/i,
  /pin\b/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /card[_-]?code/i,
  /payment/i,
  /billing/i,
];

const SENSITIVE_ARIA_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api key/i,
  /otp/i,
  /pin/i,
];

export interface SensitivityCheckInput {
  /** input element type attribute */
  inputType?: string;
  /** element name attribute */
  name?: string;
  /** aria-label value */
  ariaLabel?: string;
  /** associated label text */
  labelText?: string;
  /** placeholder text */
  placeholder?: string;
  /** autocomplete attribute */
  autocomplete?: string;
}

/**
 * Returns true if the field appears sensitive and its value should be masked.
 */
export function isSensitiveField(input: SensitivityCheckInput): boolean {
  // Explicit password / hidden input types
  if (input.inputType && SENSITIVE_INPUT_TYPES.has(input.inputType.toLowerCase())) {
    return true;
  }

  // Autocomplete hints (e.g., "new-password", "current-password", "cc-number")
  if (input.autocomplete) {
    const ac = input.autocomplete.toLowerCase();
    if (
      ac.includes('password') ||
      ac.includes('cc-') ||
      ac.includes('creditcard') ||
      ac.includes('pin')
    ) {
      return true;
    }
  }

  // Check name attribute against sensitive patterns
  if (input.name && SENSITIVE_NAME_PATTERNS.some((p) => p.test(input.name!))) {
    return true;
  }

  // Check aria-label
  if (input.ariaLabel && SENSITIVE_ARIA_PATTERNS.some((p) => p.test(input.ariaLabel!))) {
    return true;
  }

  // Check label text
  if (input.labelText && SENSITIVE_NAME_PATTERNS.some((p) => p.test(input.labelText!))) {
    return true;
  }

  // Check placeholder
  if (input.placeholder && SENSITIVE_NAME_PATTERNS.some((p) => p.test(input.placeholder!))) {
    return true;
  }

  return false;
}

export const MASKED_VALUE = '[REDACTED]';

/**
 * Returns the value to store: the original if not sensitive, or '[REDACTED]'.
 */
export function maskIfSensitive(value: string, sensitivityInput: SensitivityCheckInput): string {
  return isSensitiveField(sensitivityInput) ? MASKED_VALUE : value;
}
