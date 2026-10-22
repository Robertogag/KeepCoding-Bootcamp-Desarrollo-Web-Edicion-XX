import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', ...routing.locales.map((locale) => `/${locale}/app`)],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
