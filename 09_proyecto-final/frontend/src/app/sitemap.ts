import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getPublicPlant, listAllPublicPlants } from '@/lib/api/public';
import { absoluteUrl, localizedPath } from '@/lib/seo';

// El sitemap lee plantas y máquinas públicas del API en cada petición; no se congela en el build.
export const dynamic = 'force-dynamic';

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

function localized(
  path: string,
  changeFrequency: ChangeFrequency,
  priority: number,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(localizedPath(locale, path))]),
  );
  return routing.locales.map((locale) => ({
    url: absoluteUrl(localizedPath(locale, path)),
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [...localized('/', 'daily', 1)];
  const plants = await listAllPublicPlants().catch(() => []);
  for (const plant of plants) {
    entries.push(...localized(`/plants/${plant.slug}`, 'hourly', 0.8));
    const detail = await getPublicPlant(plant.slug).catch(() => null);
    for (const machine of detail?.machines ?? []) {
      entries.push(...localized(`/plants/${plant.slug}/${machine.slug}`, 'hourly', 0.6));
    }
  }
  return entries;
}
