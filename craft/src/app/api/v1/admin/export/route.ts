import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { buildExport } from '@/lib/admin/export';
import { apiStaff } from '@/lib/auth/guards';
import { readQuery, route } from '@/lib/http';

const Query = z.object({
  type: z.enum(['invoices', 'ledger', 'redemptions', 'craftsmen']),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const GET = route(async (req: NextRequest) => {
  const s = await apiStaff('reports:export');
  const q = readQuery(req, Query);
  const file = await buildExport(q.type, q.format, q.from ? new Date(`${q.from}T00:00:00+03:00`) : undefined, q.to ? new Date(`${q.to}T23:59:59+03:00`) : undefined);
  await audit(s.user.id, 'report.export', { type: 'report', id: q.type }, { format: q.format, from: q.from, to: q.to });
  return new NextResponse(file.body as BodyInit, {
    headers: { 'content-type': file.mime, 'content-disposition': `attachment; filename="${file.filename}"`, 'cache-control': 'private, no-store' },
  });
});
