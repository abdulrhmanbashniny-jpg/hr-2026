import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { RELEASES } from '@/lib/releases';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(`${RELEASES[0].date}T00:00:00+03:00`);
  return [
    { url: env.appUrl, lastModified: updated, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.appUrl}/contact`, lastModified: updated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${env.appUrl}/changelog`, lastModified: updated, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${env.appUrl}/register`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${env.appUrl}/login`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
