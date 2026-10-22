import { describe, expect, it } from 'vitest';
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('Paint-2026!');
    expect(stored).toMatch(/^scrypt\$15\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword('Paint-2026!', stored)).toBe(true);
    expect(await verifyPassword('paint-2026!', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });

  it('treats Arabic-Indic and ASCII digits as the same password', async () => {
    const stored = await hashPassword('ابوفهد٢٠٢٦');
    expect(await verifyPassword('ابوفهد2026', stored)).toBe(true);
  });

  it('never accepts a missing or malformed hash', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', undefined)).toBe(false);
    expect(await verifyPassword('anything', 'plain-text')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$40$8$1$AAAA$BBBB')).toBe(false);
    const stored = await hashPassword('x-123456');
    expect(await verifyPassword('x-123456', stored.replace(/\$[^$]+$/, '$AAAA'))).toBe(false);
  });
});

describe('password rules', () => {
  it('needs at least 8 characters', () => {
    expect(passwordProblem('short1')).toBe('too_short');
    expect(passwordProblem('long-enough')).toBeNull();
    expect(passwordProblem('x'.repeat(129))).toBe('too_long');
  });

  it('refuses obvious passwords and the account’s own number', () => {
    expect(passwordProblem('12345678')).toBe('too_common');
    expect(passwordProblem('١٢٣٤٥٦٧٨')).toBe('too_common');
    expect(passwordProblem('aaaaaaaaa')).toBe('too_common');
    expect(passwordProblem('0599222345', '+966599222345')).toBe('too_common');
    expect(passwordProblem('599222345', '+966599222345')).toBe('too_common');
    expect(passwordProblem('0599222345x', '+966599222345')).toBeNull();
  });

  it('issues readable one-time passwords that pass the rules', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = temporaryPassword();
      expect(p).toMatch(/^[A-Z3-9]{4}-[A-Z3-9]{4}-[A-Z3-9]{4}$/);
      expect(p).not.toMatch(/[0125OILSZ]/);
      expect(passwordProblem(p)).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });
});
