import type { MetadataRoute } from 'next';
import { fetchAllServices } from '@/lib/ct/services';
import { alternateLanguages, absoluteUrl } from '@/lib/seo';
import { LOCALES } from '@/lib/utils';

export const revalidate = 3600;

const STATIC_PATHS = ['', '/plumbing', '/waste-management', '/about', '/request-a-quote', '/privacy'];

/** Public pages only (home, both listings, every published service, About, Request a quote, Privacy). The portal, sign-in and API are not listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let services: { category: string; slug: string }[] = [];
  try {
    services = await fetchAllServices(LOCALES[0]);
  } catch {
    // The catalogue is unreachable: still publish the static pages rather than failing the sitemap.
  }
  const paths = [...STATIC_PATHS, ...services.map((s) => `/${s.category}/${s.slug}`)];
  return LOCALES.flatMap((locale) =>
    paths.map((path) => ({
      url: absoluteUrl(locale, path),
      lastModified: new Date(),
      changeFrequency: path === '' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '' ? 1 : path.split('/').length > 2 ? 0.6 : 0.8,
      alternates: { languages: alternateLanguages(path) },
    })),
  );
}
