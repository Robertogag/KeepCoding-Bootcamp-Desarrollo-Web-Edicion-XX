import type { Metadata } from 'next';
import { routing, type AppLocale } from '@/i18n/routing';
import { env } from './env';

const OG_LOCALES: Record<AppLocale, string> = { es: 'es_MX', en: 'en_US' };

export function absoluteUrl(path: string): string {
  return new URL(path, env.siteUrl).toString();
}

export function localizedPath(locale: string, path: string): string {
  return `/${locale}${path === '/' ? '' : path}`;
}

interface PageMetadataInput {
  locale: string;
  path: string;
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
}

// Título, descripción, canonical, hreflang entre idiomas y tarjetas Open Graph y Twitter en un solo lugar.
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  noIndex,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(localizedPath(locale, path));
  const languages = Object.fromEntries(
    routing.locales.map((item) => [item, absoluteUrl(localizedPath(item, path))]),
  );
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { ...languages, 'x-default': languages[routing.defaultLocale] ?? url },
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: 'OEE Live',
      locale: OG_LOCALES[locale as AppLocale] ?? OG_LOCALES.es,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
