import type { NextRequest } from 'next/server';
import { apiUser } from '@/lib/auth/guards';
import { ApiError, ok, route } from '@/lib/http';
import { MAX_UPLOAD_BYTES } from '@/lib/sniff';
import { receiveUpload } from '@/lib/uploads';

type Ctx = { params: Promise<{ id: string }> };

/** Upload target for the database and local storage drivers (S3/R2 uploads go straight to the bucket). */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const s = await apiUser();
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw new ApiError('upload_too_large');
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_UPLOAD_BYTES) throw new ApiError('upload_too_large');
  await receiveUpload(s.user.id, (await params).id, body);
  return ok({ uploaded: true });
});
