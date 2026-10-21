import { createHash, createPublicKey, verify } from 'node:crypto';
import { isValidVatNumber } from '@/lib/ids';

/**
 * ZATCA (Fatoora) QR codes: Base64 of a TLV sequence. Each field is a 1-byte tag, a 1-byte length
 * and the value. Phase 1 (generation) carries tags 1–5; Phase 2 (integration) adds the invoice hash
 * (6), the ECDSA signature (7), the public key (8) and, on simplified invoices, the signature of the
 * cryptographic stamp certificate (9).
 */
export interface ZatcaQr {
  sellerName: string;
  vatNumber: string;
  /** ISO timestamp; when the QR has no zone it is read as Riyadh time (+03:00). */
  timestamp: string | null;
  total: number | null;
  vat: number | null;
  phase: 1 | 2;
  invoiceHash: Buffer | null;
  signature: Buffer | null;
  publicKey: Buffer | null;
  certificateSignature: Buffer | null;
}

export type QrDecodeError = 'not_base64' | 'malformed_tlv' | 'missing_fields' | 'bad_vat_number';

export interface TlvField {
  tag: number;
  value: Buffer;
}

export function encodeTlv(fields: TlvField[]): Buffer {
  const parts: Buffer[] = [];
  for (const f of fields) {
    if (f.value.length > 255) throw new Error(`TLV value for tag ${f.tag} exceeds 255 bytes`);
    parts.push(Buffer.from([f.tag, f.value.length]), f.value);
  }
  return Buffer.concat(parts);
}

export function decodeTlv(bytes: Buffer): TlvField[] | null {
  const fields: TlvField[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (i + 2 > bytes.length) return null;
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (tag < 1 || tag > 20 || i + 2 + len > bytes.length) return null;
    fields.push({ tag, value: bytes.subarray(i + 2, i + 2 + len) });
    i += 2 + len;
  }
  return fields;
}

function parseAmount(v: string): number | null {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && v.trim() !== '' ? Math.round(n * 100) / 100 : null;
}

function parseTimestamp(v: string): string | null {
  const s = v.trim().replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/.test(s)) return null;
  const withTime = s.length === 10 ? `${s}T00:00:00` : s;
  const zoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(withTime) ? withTime : `${withTime}+03:00`;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function decodeZatcaQr(payload: string): { ok: true; qr: ZatcaQr } | { ok: false; error: QrDecodeError } {
  const clean = payload.trim().replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=_-]+$/.test(clean)) return { ok: false, error: 'not_base64' };
  const bytes = Buffer.from(clean.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (bytes.length < 10) return { ok: false, error: 'not_base64' };
  const fields = decodeTlv(bytes);
  if (!fields) return { ok: false, error: 'malformed_tlv' };
  const get = (tag: number) => fields.find((f) => f.tag === tag)?.value ?? null;
  const text = (tag: number) => get(tag)?.toString('utf8').trim() ?? '';

  const sellerName = text(1);
  const vatNumber = text(2);
  if (!sellerName || !vatNumber) return { ok: false, error: 'missing_fields' };
  if (!isValidVatNumber(vatNumber)) return { ok: false, error: 'bad_vat_number' };

  const invoiceHash = get(6);
  const signature = get(7);
  const publicKey = get(8);
  return {
    ok: true,
    qr: {
      sellerName,
      vatNumber,
      timestamp: parseTimestamp(text(3)),
      total: parseAmount(text(4)),
      vat: parseAmount(text(5)),
      phase: invoiceHash && signature && publicKey ? 2 : 1,
      invoiceHash,
      signature,
      publicKey,
      certificateSignature: get(9),
    },
  };
}

/** Values are stored either raw or as Base64 text depending on the POS vendor; accept both. */
function candidates(value: Buffer, looksRaw: (b: Buffer) => boolean): Buffer[] {
  const out: Buffer[] = [];
  if (looksRaw(value)) out.push(value);
  const asText = value.toString('latin1');
  if (/^[A-Za-z0-9+/]+=*$/.test(asText)) {
    const decoded = Buffer.from(asText, 'base64');
    if (decoded.length && looksRaw(decoded)) out.push(decoded);
  }
  return out;
}

const isDer = (b: Buffer) => b.length > 8 && b[0] === 0x30;

export type SignatureVerdict = 'unsigned' | 'valid' | 'invalid';

/**
 * Phase 2: checks the ECDSA (secp256k1, SHA-256) signature in tag 7 against the invoice hash in
 * tag 6 using the key in tag 8. A valid result proves the invoice hash was signed by the holder of
 * that key; whether the key belongs to the dealer is decided against the dealer's known keys.
 */
export function verifyZatcaSignature(qr: ZatcaQr): { verdict: SignatureVerdict; publicKeyB64: string | null } {
  if (qr.phase !== 2 || !qr.invoiceHash || !qr.signature || !qr.publicKey) return { verdict: 'unsigned', publicKeyB64: null };
  const keys = candidates(qr.publicKey, isDer);
  const signatures = candidates(qr.signature, isDer);
  const messages = [...candidates(qr.invoiceHash, (b) => b.length === 32), qr.invoiceHash];
  for (const keyDer of keys) {
    let key;
    try {
      key = createPublicKey({ key: keyDer, format: 'der', type: 'spki' });
    } catch {
      continue;
    }
    if (key.asymmetricKeyType !== 'ec') continue;
    const publicKeyB64 = keyDer.toString('base64');
    for (const sig of signatures)
      for (const msg of messages) {
        try {
          if (verify('sha256', msg, key, sig)) return { verdict: 'valid', publicKeyB64 };
        } catch {
          // Malformed signature encoding: try the next interpretation.
        }
      }
    return { verdict: 'invalid', publicKeyB64 };
  }
  return { verdict: 'invalid', publicKeyB64: null };
}

/**
 * One genuine invoice, one claim. Phase 2 invoices are identified by their hash, which covers the
 * whole XML invoice, so editing the amount in the QR does not produce a new fingerprint. Phase 1
 * invoices fall back to seller + time + total.
 */
export function invoiceFingerprint(input: { vatNumber: string; invoiceHash?: Buffer | null; timestamp?: string | null; total?: number | null }): string {
  const basis = input.invoiceHash?.length
    ? `h:${input.vatNumber}:${input.invoiceHash.toString('base64')}`
    : `t:${input.vatNumber}:${input.timestamp ?? ''}:${(input.total ?? 0).toFixed(2)}`;
  return createHash('sha256').update(basis).digest('hex');
}
