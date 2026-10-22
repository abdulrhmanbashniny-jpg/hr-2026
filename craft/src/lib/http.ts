import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { getLocale } from '@/lib/i18n';
import { dictionary } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n/ar';

export type ErrorCode = keyof Dictionary['errors'];

const STATUS: Partial<Record<ErrorCode, number>> = {
  validation: 400,
  invalid_phone: 400,
  invalid_code: 400,
  invalid_national_id: 400,
  upload_type: 400,
  upload_too_large: 413,
  unauthenticated: 401,
  forbidden: 403,
  bad_origin: 403,
  account_suspended: 403,
  not_found: 404,
  already_onboarded: 409,
  duplicate_image: 409,
  rate_limited: 429,
  invalid_credentials: 401,
  phone_taken: 409,
  password_too_short: 400,
  password_too_long: 400,
  password_too_common: 400,
  wrong_password: 400,
  password_reused: 400,
  password_change_required: 403,
  sms_unavailable: 503,
  not_configured: 501,
  sms_failed: 502,
  generic: 500,
};

/** A failure the client can act on: a stable code, an HTTP status and a localised message. */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number = STATUS[code] ?? 422,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

async function errorResponse(err: ApiError) {
  const t = dictionary(await getLocale().catch(() => 'ar' as const));
  return NextResponse.json(
    { error: { code: err.code, message: t.errors[err.code] ?? t.errors.generic, ...(err.details ? { details: err.details } : {}) } },
    { status: err.status, headers: err.code === 'rate_limited' ? { 'Retry-After': '60' } : undefined },
  );
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError('validation', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError('validation', 400, z.flattenError(parsed.error).fieldErrors);
  return parsed.data;
}

export function readQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError('validation', 400, z.flattenError(parsed.error).fieldErrors);
  return parsed.data;
}

/**
 * CSRF defence for cookie-authenticated mutations: the browser always sends Origin on POST, PUT,
 * PATCH and DELETE, so anything not from our own origin is refused.
 */
export function assertSameOrigin(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) throw new ApiError('bad_origin');
  const allowed = new Set([env.appUrl, new URL(req.url).origin]);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) allowed.add(`${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`);
  if (!allowed.has(origin)) throw new ApiError('bad_origin');
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: same-origin check, uniform error envelope, no stack traces to clients. */
export function route<C = unknown>(handler: Handler<C>, opts: { csrf?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      // next/navigation redirect() and notFound() are thrown as control flow.
      if (err && typeof err === 'object' && 'digest' in err) throw err;
      console.error('[api]', req.method, req.nextUrl.pathname, err);
      return errorResponse(new ApiError('generic', 500));
    }
  };
}

/**
 * The caller's address. On Vercel the platform header is authoritative. Elsewhere, X-Forwarded-For
 * is read from the right: each trusted proxy (TRUSTED_PROXY_HOPS, default 1) appends the address it
 * saw, so the entries to the left of those are whatever the client chose to send.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    if (process.env.VERCEL) {
      const v = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
      if (v) return v;
    }
    const chain = (h.get('x-forwarded-for') ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
    return chain[Math.max(0, chain.length - hops)] || h.get('x-real-ip') || null;
  } catch {
    return null;
  }
}

/** The /24 (IPv4) or /48 (IPv6) network an address belongs to, for clustering without keeping the address. */
export function ipPrefix(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':');
  return ip.split('.').slice(0, 3).join('.');
}

export const NO_STORE = { 'Cache-Control': 'private, no-store' };
