/**
 * Normalizes Kenyan phone numbers to the format +2547XXXXXXXX
 * Handles various input formats:
 * - 07XXXXXXXX
 * - 7XXXXXXXX
 * - +2547XXXXXXXX
 * - 2547XXXXXXXX
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digitsOnly.length === 10 && digitsOnly.startsWith('07')) {
    // Format: 07XXXXXXXX -> +2547XXXXXXXX
    return '+254' + digitsOnly.substring(1);
  } else if (digitsOnly.length === 9 && digitsOnly.startsWith('7')) {
    // Format: 7XXXXXXXX -> +2547XXXXXXXX
    return '+254' + digitsOnly;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('254')) {
    // Format: 2547XXXXXXXX -> +2547XXXXXXXX
    return '+' + digitsOnly;
  } else if (digitsOnly.length === 13 && digitsOnly.startsWith('+254')) {
    // Format: +2547XXXXXXXX -> +2547XXXXXXXX (already correct)
    return digitsOnly;
  }
  
  // If none of the above conditions match, return as is
  // This allows for other international formats if needed
  return phone;
}

/**
 * Validates if a phone number is in the correct Kenyan format
 */
export function isValidKenyanPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  const kenyanPhoneRegex = /^\+254(7\d{8}|1\d{8})$/; // +2547XXXXXXXX or +2541XXXXXXXX
  return kenyanPhoneRegex.test(normalized);
}