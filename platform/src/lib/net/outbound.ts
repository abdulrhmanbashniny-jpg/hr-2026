import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';

/**
 * Outbound connections to addresses chosen by customers (their own SMTP server, a WhatsApp
 * webhook) must never reach the platform's own network: loopback, private ranges, link-local
 * (cloud metadata), carrier-grade NAT and the like. Every resolved address is checked, the
 * connection is made to the checked address (so DNS cannot change in between), and redirects are
 * not followed.
 */
export class BlockedDestinationError extends Error {
  constructor(public readonly reason: 'invalid' | 'private' | 'port' | 'unresolved') {
    super(`Blocked outbound destination (${reason})`);
  }
}

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function isPublicV4(ip: string): boolean {
  const n = v4ToInt(ip);
  return !V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

/** Expands an IPv6 address to eight 16-bit groups. */
function v6Groups(ip: string): number[] | null {
  let addr = ip.toLowerCase().split('%')[0];
  let tail: number[] = [];
  const v4 = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (!net.isIPv4(v4[1])) return null;
    const n = v4ToInt(v4[1]);
    tail = [n >>> 16, n & 0xffff];
    addr = addr.slice(0, -v4[1].length) + (addr.endsWith(':' + v4[1]) ? '0:0' : '');
    addr = addr.replace(/:0:0$/, '');
  }
  const [head, rest] = addr.split('::');
  const parse = (s: string) => (s ? s.split(':').filter(Boolean).map((g) => parseInt(g, 16)) : []);
  const a = parse(head);
  const b = rest !== undefined ? parse(rest) : [];
  const fill = 8 - tail.length - a.length - b.length;
  if (fill < 0 || (rest === undefined && fill !== 0)) return null;
  const groups = [...a, ...Array(rest !== undefined ? fill : 0).fill(0), ...b, ...tail];
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isPublicV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return false;
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicV4(embeddedV4()); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPublicV4(embeddedV4()); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return false; // discard prefix
  return true;
}

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicV4(ip);
  if (net.isIPv6(ip)) return isPublicV6(ip);
  return false;
}

/** Resolves a host name and returns a public address to connect to, or throws if any address is not public. */
export async function resolvePublicHost(host: string): Promise<{ address: string; family: 4 | 6 }> {
  const name = host.trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (!name || name.length > 253 || /[\s/@?#]/.test(name)) throw new BlockedDestinationError('invalid');
  if (net.isIP(name)) {
    if (!isPublicAddress(name)) throw new BlockedDestinationError('private');
    return { address: name, family: net.isIPv4(name) ? 4 : 6 };
  }
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local') || name.endsWith('.internal')) throw new BlockedDestinationError('private');
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(name, { all: true, verbatim: true });
  } catch {
    throw new BlockedDestinationError('unresolved');
  }
  if (!records.length) throw new BlockedDestinationError('unresolved');
  if (records.some((r) => !isPublicAddress(r.address))) throw new BlockedDestinationError('private');
  const pick = records.find((r) => r.family === 4) ?? records[0];
  return { address: pick.address, family: pick.family === 6 ? 6 : 4 };
}

export const SMTP_PORTS = [25, 465, 587, 2525];

/** Checks a customer SMTP server and returns the address to connect to (host name kept for TLS). */
export async function checkSmtpDestination(host: string, port: number): Promise<string> {
  if (!SMTP_PORTS.includes(port)) throw new BlockedDestinationError('port');
  return (await resolvePublicHost(host)).address;
}

/** Validates a customer webhook URL: https only, no credentials in the URL, public destination. */
export async function checkWebhookUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedDestinationError('invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new BlockedDestinationError('invalid');
  await resolvePublicHost(url.hostname);
  return url;
}

/**
 * POSTs JSON to a customer webhook. The socket connects only to an address that passed the check,
 * redirects are treated as errors, and the call is bounded in time and response size.
 */
export async function postToWebhook(raw: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 10_000): Promise<{ status: number; text: string }> {
  const url = await checkWebhookUrl(raw);
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(payload.length), ...headers },
        timeout: timeoutMs,
        agent: false,
        lookup: (hostname, _opts, cb) => {
          resolvePublicHost(hostname).then(
            (r) => cb(null, r.address, r.family),
            (err: Error) => cb(err as NodeJS.ErrnoException, '', 4),
          );
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 64 * 1024) {
            req.destroy(new Error('Webhook response too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('Webhook timed out')));
    req.on('error', reject);
    req.end(payload);
  });
}
