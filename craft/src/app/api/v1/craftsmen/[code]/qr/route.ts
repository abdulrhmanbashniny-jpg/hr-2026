import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { codeFromParam, leadSource } from '@/lib/craftsmen/lookup';
import { env } from '@/lib/env';
import { route } from '@/lib/http';

type Ctx = { params: Promise<{ code: string }> };

/** Contextual QR: the profile link (for clients) or the referral sign-up link (for colleagues). */
export const GET = route<Ctx>(
  async (req: NextRequest, { params }) => {
    const code = codeFromParam((await params).code);
    const target = req.nextUrl.searchParams.get('target') === 'join' ? 'join' : 'profile';
    const src = leadSource(req.nextUrl.searchParams.get('src') ?? 'qr');
    const dark = /^[0-9a-fA-F]{6}$/.test(req.nextUrl.searchParams.get('fg') ?? '') ? `#${req.nextUrl.searchParams.get('fg')}` : '#102A43';
    const url = target === 'join' ? `${env.appUrl}/join?ref=${code}` : `${env.appUrl}/c/${code}?src=${src}`;
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark, light: '#0000' } });
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400, immutable' } });
  },
  { csrf: false },
);
