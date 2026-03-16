import { normalizePhone, isValidKenyanPhone } from '../normalizePhone';

describe('normalizePhone', () => {
  test('should convert 07 format to +254 format', () => {
    expect(normalizePhone('0712345678')).toBe('+254712345678');
    expect(normalizePhone('0700123456')).toBe('+254700123456');
  });

  test('should convert 7 format to +254 format', () => {
    expect(normalizePhone('712345678')).toBe('+254712345678');
    expect(normalizePhone('700123456')).toBe('+254700123456');
  });

  test('should convert 254 format to +254 format', () => {
    expect(normalizePhone('254712345678')).toBe('+254712345678');
    expect(normalizePhone('254700123456')).toBe('+254700123456');
  });

  test('should keep +254 format as is', () => {
    expect(normalizePhone('+254712345678')).toBe('+254712345678');
    expect(normalizePhone('+254700123456')).toBe('+254700123456');
  });

  test('should handle extra spaces and separators', () => {
    expect(normalizePhone('071 234 5678')).toBe('+254712345678');
    expect(normalizePhone('+254 712 345 678')).toBe('+254712345678');
    expect(normalizePhone('(071) 234-5678')).toBe('+254712345678');
  });
});

describe('isValidKenyanPhone', () => {
  test('should return true for valid Kenyan phone numbers', () => {
    expect(isValidKenyanPhone('0712345678')).toBe(true);
    expect(isValidKenyanPhone('0700123456')).toBe(true);
    expect(isValidKenyanPhone('712345678')).toBe(true);
    expect(isValidKenyanPhone('700123456')).toBe(true);
    expect(isValidKenyanPhone('254712345678')).toBe(true);
    expect(isValidKenyanPhone('+254712345678')).toBe(true);
    expect(isValidKenyanPhone('+254700123456')).toBe(true);
    expect(isValidKenyanPhone('+254100123456')).toBe(true); // Safaricom format
  });

  test('should return false for invalid Kenyan phone numbers', () => {
    expect(isValidKenyanPhone('071234567')).toBe(false); // Too short
    expect(isValidKenyanPhone('07123456789')).toBe(false); // Too long
    expect(isValidKenyanPhone('0112345678')).toBe(false); // Doesn't start with 7
    expect(isValidKenyanPhone('0812345678')).toBe(false); // Doesn't start with 7
    expect(isValidKenyanPhone('1234567890')).toBe(false); // Not Kenyan format
    expect(isValidKenyanPhone('')).toBe(false);
    expect(isValidKenyanPhone('abc')).toBe(false);
  });
});