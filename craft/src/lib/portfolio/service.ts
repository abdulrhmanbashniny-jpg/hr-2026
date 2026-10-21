import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { portfolioMedia, portfolioProjects, type ColorUsed } from '@/db/schema';
import { invalidateProfile } from '@/lib/craftsmen/service';
import { ApiError } from '@/lib/http';
import { storage, mediaUrl } from '@/lib/storage';
import { claimUpload } from '@/lib/uploads';

export const MAX_MEDIA_PER_PROJECT = 5;

export interface ProjectInput {
  title: string;
  description?: string | null;
  cityId?: string | null;
  district?: string | null;
  completedOn?: string | null;
  areaSqm?: number | null;
  brandId?: string | null;
  colors?: ColorUsed[];
  warrantyMonths?: number | null;
  isPublished?: boolean;
}

async function ownProject(craftsmanId: string, projectId: string) {
  const [p] = await db.select().from(portfolioProjects).where(and(eq(portfolioProjects.id, projectId), eq(portfolioProjects.craftsmanId, craftsmanId)));
  if (!p) throw new ApiError('not_found');
  return p;
}

export async function listProjects(craftsmanId: string) {
  const projects = await db.select().from(portfolioProjects).where(eq(portfolioProjects.craftsmanId, craftsmanId)).orderBy(asc(portfolioProjects.sortOrder), desc(portfolioProjects.createdAt));
  const media = projects.length ? await db.select().from(portfolioMedia).where(inArray(portfolioMedia.projectId, projects.map((p) => p.id))).orderBy(asc(portfolioMedia.sortOrder)) : [];
  return projects.map((p) => ({
    ...p,
    media: media.filter((m) => m.projectId === p.id).map((m) => ({ ...m, url: mediaUrl(m.storageKey), thumbUrl: mediaUrl(m.thumbKey), posterUrl: mediaUrl(m.posterKey) })),
  }));
}

export async function getProject(craftsmanId: string, projectId: string) {
  const p = await ownProject(craftsmanId, projectId);
  const media = await db.select().from(portfolioMedia).where(eq(portfolioMedia.projectId, p.id)).orderBy(asc(portfolioMedia.sortOrder));
  return { ...p, media: media.map((m) => ({ ...m, url: mediaUrl(m.storageKey), thumbUrl: mediaUrl(m.thumbKey), posterUrl: mediaUrl(m.posterKey) })) };
}

export async function createProject(craftsmanId: string, code: string, input: ProjectInput) {
  const [{ n }] = await db.select({ n: count() }).from(portfolioProjects).where(eq(portfolioProjects.craftsmanId, craftsmanId));
  const [p] = await db
    .insert(portfolioProjects)
    .values({ craftsmanId, ...input, colors: input.colors ?? [], sortOrder: n })
    .returning();
  invalidateProfile(code);
  return p;
}

export async function updateProject(craftsmanId: string, code: string, projectId: string, input: Partial<ProjectInput>) {
  await ownProject(craftsmanId, projectId);
  const [p] = await db
    .update(portfolioProjects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(portfolioProjects.id, projectId))
    .returning();
  invalidateProfile(code);
  return p;
}

export async function deleteProject(craftsmanId: string, code: string, projectId: string) {
  await ownProject(craftsmanId, projectId);
  const media = await db.select().from(portfolioMedia).where(eq(portfolioMedia.projectId, projectId));
  await db.delete(portfolioProjects).where(eq(portfolioProjects.id, projectId));
  for (const m of media) for (const key of [m.storageKey, m.thumbKey, m.posterKey]) if (key) await storage().delete(key).catch(() => undefined);
  invalidateProfile(code);
}

export interface MediaInput {
  uploadId: string;
  thumbUploadId?: string | null;
  posterUploadId?: string | null;
  role: 'before' | 'after' | 'gallery';
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  lqip?: string | null;
  capturedAt?: string | null;
  geo?: { lat: number; lng: number } | null;
}

export async function addMedia(userId: string, craftsmanId: string, code: string, projectId: string, input: MediaInput) {
  await ownProject(craftsmanId, projectId);
  const row = await db.transaction(async (tx) => {
    // Lock the project row so two parallel uploads cannot both slip under the limit.
    await tx.select({ id: portfolioProjects.id }).from(portfolioProjects).where(eq(portfolioProjects.id, projectId)).for('update');
    const [{ n }] = await tx.select({ n: count() }).from(portfolioMedia).where(eq(portfolioMedia.projectId, projectId));
    if (n >= MAX_MEDIA_PER_PROJECT) throw new ApiError('media_limit');
    const file = await claimUpload(userId, input.uploadId, 'portfolio', tx);
    const thumb = input.thumbUploadId ? await claimUpload(userId, input.thumbUploadId, 'portfolio', tx) : null;
    const poster = input.posterUploadId ? await claimUpload(userId, input.posterUploadId, 'portfolio', tx) : null;
    const kind = file.mime.startsWith('video/') ? 'video' : 'image';
    if (thumb && !thumb.mime.startsWith('image/')) throw new ApiError('upload_type');
    if (poster && !poster.mime.startsWith('image/')) throw new ApiError('upload_type');
    const [m] = await tx
      .insert(portfolioMedia)
      .values({
        projectId,
        craftsmanId,
        kind,
        role: input.role,
        storageKey: file.key,
        thumbKey: thumb?.key ?? null,
        posterKey: poster?.key ?? null,
        mime: file.mime,
        bytes: file.bytes,
        sha256: file.sha256,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSec: kind === 'video' ? (input.durationSec ?? null) : null,
        lqip: input.lqip && input.lqip.length < 4000 && input.lqip.startsWith('data:image/') ? input.lqip : null,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
        geoLat: input.geo?.lat ?? null,
        geoLng: input.geo?.lng ?? null,
        sortOrder: n,
      })
      .returning();
    return m;
  });
  invalidateProfile(code);
  return { ...row, url: mediaUrl(row.storageKey), thumbUrl: mediaUrl(row.thumbKey), posterUrl: mediaUrl(row.posterKey) };
}

export async function deleteMedia(craftsmanId: string, code: string, mediaId: string) {
  const [m] = await db.delete(portfolioMedia).where(and(eq(portfolioMedia.id, mediaId), eq(portfolioMedia.craftsmanId, craftsmanId))).returning();
  if (!m) throw new ApiError('not_found');
  for (const key of [m.storageKey, m.thumbKey, m.posterKey]) if (key) await storage().delete(key).catch(() => undefined);
  invalidateProfile(code);
}

export async function setMediaRole(craftsmanId: string, code: string, mediaId: string, role: 'before' | 'after' | 'gallery') {
  const [m] = await db.update(portfolioMedia).set({ role }).where(and(eq(portfolioMedia.id, mediaId), eq(portfolioMedia.craftsmanId, craftsmanId))).returning({ id: portfolioMedia.id });
  if (!m) throw new ApiError('not_found');
  invalidateProfile(code);
}
