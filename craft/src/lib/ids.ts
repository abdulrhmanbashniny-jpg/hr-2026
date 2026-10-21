import { digitsOnly } from '@/lib/digits';

/**
 * Saudi national ID (starts with 1) or iqama (starts with 2): 10 digits with a Luhn check, where
 * digits in odd positions (1st, 3rd…) are doubled.
 */
export function isValidSaudiId(input: string): boolean {
  const id = digitsOnly(input);
  if (!/^[12]\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = id.charCodeAt(i) - 48;
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** ZATCA VAT registration number: 15 digits, first and last digit 3. */
export function isValidVatNumber(input: string): boolean {
  return /^3\d{13}3$/.test(digitsOnly(input));
}
