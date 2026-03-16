/**
 * Utility functions for phone number operations
 */

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

/**
 * Simple test function for phone normalization
 * This can be run manually to verify the functionality
 */
export function runPhoneTests(): void {
  console.log('Running phone normalization tests...\n');

  // Test cases
  const testCases = [
    { input: '0712345678', expected: '+254712345678' },
    { input: '0700123456', expected: '+254700123456' },
    { input: '712345678', expected: '+254712345678' },
    { input: '700123456', expected: '+254700123456' },
    { input: '254712345678', expected: '+254712345678' },
    { input: '254700123456', expected: '+254700123456' },
    { input: '+254712345678', expected: '+254712345678' },
    { input: '+254700123456', expected: '+254700123456' },
    { input: '071 234 5678', expected: '+254712345678' },
    { input: '+254 712 345 678', expected: '+254712345678' },
    { input: '(071) 234-5678', expected: '+254712345678' },
  ];

  let passed = 0;
  let total = testCases.length;

  testCases.forEach((testCase, index) => {
    const result = normalizePhone(testCase.input);
    const success = result === testCase.expected;
    
    console.log(`Test ${index + 1}: ${success ? 'PASS' : 'FAIL'}`);
    console.log(`  Input: "${testCase.input}"`);
    console.log(`  Expected: "${testCase.expected}"`);
    console.log(`  Got: "${result}"`);
    console.log('');

    if (success) passed++;
  });

  // Test validation function
  console.log('Running phone validation tests...\n');
  
  const validationTests = [
    { input: '0712345678', expected: true },
    { input: '0700123456', expected: true },
    { input: '712345678', expected: true },
    { input: '700123456', expected: true },
    { input: '254712345678', expected: true },
    { input: '+254712345678', expected: true },
    { input: '+254700123456', expected: true },
    { input: '+254100123456', expected: true }, // Safaricom format
    { input: '071234567', expected: false }, // Too short
    { input: '07123456789', expected: false }, // Too long
    { input: '0112345678', expected: false }, // Doesn't start with 7
    { input: '0812345678', expected: false }, // Doesn't start with 7
    { input: '1234567890', expected: false }, // Not Kenyan format
    { input: '', expected: false },
    { input: 'abc', expected: false },
  ];

  total += validationTests.length;

  validationTests.forEach((testCase, index) => {
    const result = isValidKenyanPhone(testCase.input);
    const success = result === testCase.expected;
    
    console.log(`Validation Test ${index + 1}: ${success ? 'PASS' : 'FAIL'}`);
    console.log(`  Input: "${testCase.input}"`);
    console.log(`  Expected: ${testCase.expected}`);
    console.log(`  Got: ${result}`);
    console.log('');

    if (success) passed++;
  });

  console.log(`\nSummary: ${passed}/${total} tests passed`);
}