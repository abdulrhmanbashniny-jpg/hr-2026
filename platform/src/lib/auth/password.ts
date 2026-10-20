import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function passwordProblem(plain: string): string | null {
  if (plain.length < 10) return 'password_too_short';
  if (!/[A-Za-z؀-ۿ]/.test(plain) || !/\d/.test(plain)) return 'password_too_weak';
  return null;
}
