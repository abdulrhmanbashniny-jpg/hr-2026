import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeZatcaQr, encodeTlv, invoiceFingerprint, verifyZatcaSignature } from '@/lib/zatca/qr';

const VAT = '310122393500003';
const utf8 = (s: string) => Buffer.from(s, 'utf8');

function phase1(fields: Partial<Record<1 | 2 | 3 | 4 | 5, string>> = {}) {
  const v = { 1: 'مؤسسة الألوان الحديثة', 2: VAT, 3: '2026-10-20T14:30:00Z', 4: '1150.00', 5: '150.00', ...fields };
  return encodeTlv(([1, 2, 3, 4, 5] as const).map((tag) => ({ tag, value: utf8(v[tag]) }))).toString('base64');
}

function phase2(opts: { tamperHash?: boolean; rawSignature?: boolean; otherKey?: boolean; hashEncoding?: 'base64' | 'raw' | 'unpadded' | 'padded'; vat?: string } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const signer = opts.otherKey ? generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey : privateKey;
  const hash = createHash('sha256').update('<Invoice>…</Invoice>').digest();
  const signature = sign('sha256', hash, signer);
  const hashForQr = opts.tamperHash ? createHash('sha256').update('other').digest() : hash;
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const b64 = hashForQr.toString('base64');
  const tag6 = { base64: utf8(b64), raw: hashForQr, unpadded: utf8(b64.replace(/=+$/, '')), padded: utf8(`${b64}==`) }[opts.hashEncoding ?? 'base64'];
  const tlv = encodeTlv([
    { tag: 1, value: utf8('Al Alwan Paints') },
    { tag: 2, value: utf8(opts.vat ?? VAT) },
    { tag: 3, value: utf8('2026-10-20T17:30:00') },
    { tag: 4, value: utf8('2300.00') },
    { tag: 5, value: utf8('300.00') },
    { tag: 6, value: tag6 },
    { tag: 7, value: opts.rawSignature ? signature : utf8(signature.toString('base64')) },
    { tag: 8, value: spki },
    { tag: 9, value: Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]) },
  ]);
  return { payload: tlv.toString('base64'), spkiB64: spki.toString('base64'), hash };
}

describe('ZATCA QR decoding', () => {
  it('decodes a phase 1 QR with Arabic seller name', () => {
    const r = decodeZatcaQr(phase1());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.qr).toMatchObject({ sellerName: 'مؤسسة الألوان الحديثة', vatNumber: VAT, total: 1150, vat: 150, phase: 1, timestamp: '2026-10-20T14:30:00.000Z' });
  });

  it('reads timestamps without a zone as Riyadh time', () => {
    const r = decodeZatcaQr(phase1({ 3: '2026-10-20 17:30:00' }));
    expect(r.ok && r.qr.timestamp).toBe('2026-10-20T14:30:00.000Z');
  });

  it('reads Arabic-Indic amounts and treats amounts without digits as unknown', () => {
    const ar = decodeZatcaQr(phase1({ 4: '١١٥٠٫٠٠', 5: '١٥٠٫٠٠' }));
    expect(ar.ok && [ar.qr.total, ar.qr.vat]).toEqual([1150, 150]);
    const junk = decodeZatcaQr(phase1({ 4: 'SAR', 5: '-' }));
    expect(junk.ok && [junk.qr.total, junk.qr.vat]).toEqual([null, null]);
  });

  it('rejects garbage, broken TLV and bad VAT numbers', () => {
    expect(decodeZatcaQr('not a qr ✓')).toEqual({ ok: false, error: 'not_base64' });
    expect(decodeZatcaQr(Buffer.from([1, 200, 65, 65, 65, 65, 65, 65, 65, 65, 65]).toString('base64'))).toEqual({ ok: false, error: 'malformed_tlv' });
    expect(decodeZatcaQr(phase1({ 2: '123456789012345' }))).toEqual({ ok: false, error: 'bad_vat_number' });
  });
});

describe('ZATCA phase 2 signature', () => {
  it('verifies a genuine signature (base64 text and raw DER encodings)', () => {
    for (const rawSignature of [false, true]) {
      const { payload, spkiB64 } = phase2({ rawSignature });
      const r = decodeZatcaQr(payload);
      expect(r.ok && r.qr.phase).toBe(2);
      if (!r.ok) return;
      expect(verifyZatcaSignature(r.qr)).toMatchObject({ verdict: 'valid', publicKeyB64: spkiB64 });
    }
  });

  it('rejects a hash that was swapped after signing', () => {
    const r = decodeZatcaQr(phase2({ tamperHash: true }).payload);
    expect(r.ok && verifyZatcaSignature(r.qr).verdict).toBe('invalid');
  });

  it('rejects a signature made with a different key', () => {
    const r = decodeZatcaQr(phase2({ otherKey: true }).payload);
    expect(r.ok && verifyZatcaSignature(r.qr).verdict).toBe('invalid');
  });

  it('reports phase 1 codes as unsigned', () => {
    const r = decodeZatcaQr(phase1());
    expect(r.ok && verifyZatcaSignature(r.qr).verdict).toBe('unsigned');
  });
});

describe('invoice fingerprint', () => {
  it('identifies phase 2 invoices by hash, so editing the amount or the seller VAT text does not create a new claim', () => {
    const hash = Buffer.alloc(32, 7);
    const a = invoiceFingerprint({ vatNumber: VAT, digest: hash, total: 100 });
    const b = invoiceFingerprint({ vatNumber: '399999999900003', digest: hash, total: 9999 });
    expect(a).toBe(b);
  });

  it('gives one fingerprint for every encoding of the same signed hash (raw, Base64, unpadded, extra padding)', () => {
    const prints = new Set<string>();
    for (const hashEncoding of ['base64', 'raw', 'unpadded', 'padded'] as const) {
      const { payload, hash } = phase2({ hashEncoding });
      const r = decodeZatcaQr(payload);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const v = verifyZatcaSignature(r.qr);
      expect(v.verdict).toBe('valid');
      expect(v.digest?.equals(hash)).toBe(true);
      prints.add(invoiceFingerprint({ vatNumber: r.qr.vatNumber, digest: v.digest, total: r.qr.total }));
    }
    // Each phase2() call signs a new key but the same invoice hash, so all encodings must collide.
    expect(prints.size).toBe(1);
  });

  it('falls back to seller, time and total for phase 1', () => {
    const a = invoiceFingerprint({ vatNumber: VAT, timestamp: '2026-10-20T14:30:00.000Z', total: 1150 });
    const b = invoiceFingerprint({ vatNumber: VAT, timestamp: '2026-10-20T14:30:00.000Z', total: 1151 });
    expect(a).not.toBe(b);
  });
});
