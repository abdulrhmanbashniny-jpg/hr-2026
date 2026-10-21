import { and, countDistinct, eq, gt, ne } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db, type DbOrTx } from '@/db';
import { deviceSignals } from '@/db/schema';
import { hmac } from '@/lib/crypto';
import { clientIp, ipPrefix } from '@/lib/http';
import { deviceId } from '@/lib/auth/session';

export interface RequestFingerprint {
  deviceId: string | null;
  ipHash: string | null;
  ipPrefixHash: string | null;
  uaHash: string | null;
}

/** What we keep about the request for fraud checks: keyed hashes only, never the raw address. */
export async function requestFingerprint(): Promise<RequestFingerprint> {
  const ip = await clientIp();
  const ua = (await headers()).get('user-agent');
  return {
    deviceId: await deviceId(),
    ipHash: ip ? hmac(ip, 'ip') : null,
    ipPrefixHash: ip ? hmac(ipPrefix(ip), 'ip-prefix') : null,
    uaHash: ua ? hmac(ua, 'ua') : null,
  };
}

export async function recordSignal(
  userId: string,
  event: 'signup' | 'login' | 'invoice' | 'referral',
  fp: RequestFingerprint,
  clientFingerprint?: string | null,
  tx: DbOrTx = db,
) {
  await tx.insert(deviceSignals).values({
    userId,
    event,
    deviceId: fp.deviceId,
    ipHash: fp.ipHash,
    ipPrefixHash: fp.ipPrefixHash,
    uaHash: fp.uaHash,
    fingerprint: clientFingerprint ? hmac(clientFingerprint, 'fp') : null,
  });
}

/** Number of other accounts seen on this device. */
export async function otherAccountsOnDevice(userId: string, device: string | null, tx: DbOrTx = db): Promise<number> {
  if (!device) return 0;
  const [{ n }] = await tx
    .select({ n: countDistinct(deviceSignals.userId) })
    .from(deviceSignals)
    .where(and(eq(deviceSignals.deviceId, device), ne(deviceSignals.userId, userId)));
  return n;
}

export async function seenOnDevice(userId: string, device: string | null, tx: DbOrTx = db): Promise<boolean> {
  if (!device) return false;
  const [row] = await tx.select({ id: deviceSignals.id }).from(deviceSignals).where(and(eq(deviceSignals.deviceId, device), eq(deviceSignals.userId, userId))).limit(1);
  return !!row;
}

export async function seenOnNetworkSince(userId: string, prefixHash: string | null, since: Date, tx: DbOrTx = db): Promise<boolean> {
  if (!prefixHash) return false;
  const [row] = await tx
    .select({ id: deviceSignals.id })
    .from(deviceSignals)
    .where(and(eq(deviceSignals.ipPrefixHash, prefixHash), eq(deviceSignals.userId, userId), gt(deviceSignals.createdAt, since)))
    .limit(1);
  return !!row;
}
