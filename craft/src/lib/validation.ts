import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '@/lib/sniff';

export const SignBody = z.object({
  mime: z.string().max(80),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const ColorSchema = z.object({ name: z.string().trim().min(1).max(40), code: z.string().trim().max(30).optional(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

export const ProjectBody = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  cityId: z.string().max(40).nullable().optional(),
  district: z.string().trim().max(60).nullable().optional(),
  completedOn: z.iso.date().nullable().optional(),
  areaSqm: z.number().int().min(1).max(1_000_000).nullable().optional(),
  brandId: z.uuid().nullable().optional(),
  colors: z.array(ColorSchema).max(12).optional(),
  warrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
  productIds: z.array(z.uuid()).max(6).optional(),
  isPublished: z.boolean().optional(),
});
