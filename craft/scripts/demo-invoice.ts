/**
 * QA helper: issues a Phase 2 (signed) ZATCA QR payload from one of the seeded demo dealers, the
 * way a real cashier device would, so the full pipeline (decode → signature → known key → risk →
 * auto-approval) can be exercised end to end.
 *   npx tsx scripts/demo-invoice.ts [total] [--svg out.svg]
 */
import '../src/db/load-env';
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { closeDb, getDb } from '../src/db';
import { appSettings } from '../src/db/schema';
import { decryptSecret } from '../src/lib/crypto';
import { encodeTlv } from '../src/lib/zatca/qr';

const VAT = '310000000100003';

async function main() {
  const total = Number(process.argv[2]) || 1897.5;
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'demo_signing_keys'));
  const keys = (row?.value ?? {}) as Record<string, string>;
  if (!keys[VAT]) throw new Error('No demo signing key; run the seed first.');
  const privateKey = createPrivateKey(decryptSecret(keys[VAT]));
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const hash = createHash('sha256').update(`<Invoice>${randomBytes(16).toString('hex')}</Invoice>`).digest();
  const signature = sign('sha256', hash, privateKey);
  const vat = Math.round((total - total / 1.15) * 100) / 100;
  const utf8 = (s: string) => Buffer.from(s, 'utf8');
  const payload = encodeTlv([
    { tag: 1, value: utf8('معرض الصحراء للدهانات — الملقا') },
    { tag: 2, value: utf8(VAT) },
    { tag: 3, value: utf8(new Date().toISOString()) },
    { tag: 4, value: utf8(total.toFixed(2)) },
    { tag: 5, value: utf8(vat.toFixed(2)) },
    { tag: 6, value: utf8(hash.toString('base64')) },
    { tag: 7, value: utf8(signature.toString('base64')) },
    { tag: 8, value: spki },
  ]).toString('base64');
  const svgIdx = process.argv.indexOf('--svg');
  if (svgIdx > 0) await writeFile(process.argv[svgIdx + 1], await QRCode.toString(payload, { type: 'svg', margin: 2 }));
  console.log(payload);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
