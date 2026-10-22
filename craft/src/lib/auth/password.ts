import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { normalizeDigits } from '@/lib/digits';
import { PASSWORD_MAX, PASSWORD_MIN } from './password-rules';

/**
 * Password hashing with scrypt (memory-hard, built into Node, no native dependency).
 * Stored as `scrypt$<log2 N>$<r>$<p>$<salt>$<hash>` so the cost can rise later without breaking
 * existing hashes: verification reads the parameters from the stored value.
 */

const LOG_N = 15;
const R = 8;
const P = 1;
const KEY_LEN = 32;
// scrypt needs 128 * N * r bytes; 32 MiB at these settings, above Node's 32 MiB default ceiling.
const MAX_MEM = 64 * 1024 * 1024;

export { PASSWORD_MAX, PASSWORD_MIN };

function derive(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: 2 ** logN, r, p, maxmem: MAX_MEM };
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

/**
 * The same password typed on an Arabic or an English keyboard must match: digits become ASCII and
 * the text is NFKC-normalised. Surrounding spaces are kept; they are part of what the user chose.
 */
export function normalizePassword(password: string): string {
  return normalizeDigits(password.normalize('NFKC'));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(normalizePassword(password), salt, LOG_N, R, P);
  return ['scrypt', LOG_N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/** A real hash of a random password, so checks for unknown numbers take as long as real ones. */
let decoy: Promise<string> | null = null;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(24).toString('base64url'));
  return decoy;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const value = stored ?? (await decoyHash());
  const parts = value.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [logN, r, p] = parts.slice(1, 4).map(Number);
  if (![logN, r, p].every(Number.isInteger) || logN < 10 || logN > 20 || r < 1 || r > 32 || p < 1 || p > 4) return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length < 8 || expected.length !== KEY_LEN) return false;
  const actual = await derive(normalizePassword(password), salt, logN, r, p);
  return timingSafeEqual(actual, expected) && stored != null;
}

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'password', 'password1', 'passw0rd', 'qwertyui', 'qwerty123', 'asdfghjk', 'abcd1234', 'abc12345',
  'iloveyou', 'admin123', 'welcome1', 'zxcvbnm1', '1q2w3e4r', 'qwerty12', '123qweasd', 'a1234567',
]);

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common';

/** Length and an obvious-password check. No composition rules: they push people to worse passwords. */
export function passwordProblem(password: string, phone?: string): PasswordProblem | null {
  const p = normalizePassword(password);
  const length = [...p].length;
  if (length < PASSWORD_MIN) return 'too_short';
  if (length > PASSWORD_MAX) return 'too_long';
  const lower = p.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/u.test(p)) return 'too_common';
  if (phone) {
    const local = phone.replace(/^\+966/, '0');
    const national = phone.replace(/^\+966/, '');
    if (lower === local || lower === national || lower === phone.replace('+', '')) return 'too_common';
  }
  return null;
}

// No 0/O, 1/I/L, 5/S, 2/Z: read aloud or copied by hand without mistakes.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789';

/** A one-time password staff hand to a user, e.g. "KM7Q-TX4P-9AHW". The user must replace it. */
export function temporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += TEMP_ALPHABET[randomInt(0, TEMP_ALPHABET.length)];
    groups.push(s);
  }
  return groups.join('-');
}

/**
 * A one-time password as it may arrive from a phone keyboard ("km7q tx4p 9ahw", "KM7QTX4P9AHW"),
 * put back in its issued form, or null if it cannot be one.
 */
export function temporaryPasswordForm(input: string): string | null {
  const compact = normalizePassword(input).toUpperCase().replace(/[\s\-–—_.]/g, '');
  if (compact.length !== 12 || [...compact].some((ch) => !TEMP_ALPHABET.includes(ch))) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`;
}
