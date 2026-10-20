import { describe, expect, it } from 'vitest';
import { cleanContactPhone, isContactCategory } from '@/lib/contact-categories';
import { normalizeSaudiPhone } from '@/lib/notifications/wa-link';

describe('contact form input', () => {
  it('reads mobile numbers typed with Arabic or Latin digits', () => {
    expect(cleanContactPhone('٠٥٣٧٣٧٥٥٨٠')).toBe('0537375580');
    expect(cleanContactPhone('053 737 5580')).toBe('0537375580');
    expect(cleanContactPhone('+966-53-737-5580')).toBe('+966537375580');
    expect(cleanContactPhone('12345')).toBeNull();
    expect(cleanContactPhone('call me')).toBeNull();
  });

  it('turns a Saudi mobile into a WhatsApp number', () => {
    expect(normalizeSaudiPhone(cleanContactPhone('٠٥٣٧٣٧٥٥٨٠'))).toBe('966537375580');
  });

  it('accepts only the three message types', () => {
    expect(isContactCategory('problem')).toBe(true);
    expect(isContactCategory('improvement')).toBe(true);
    expect(isContactCategory('other')).toBe(true);
    expect(isContactCategory('spam')).toBe(false);
  });
});
