import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/admin', '/api', '/s/', '/invite', '/reset-password'] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
