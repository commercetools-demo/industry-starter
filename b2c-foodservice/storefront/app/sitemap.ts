import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { isInstore } from '@/lib/app-mode';
import { buildSitemap } from '@/lib/content/sitemap';
import { siteOrigin } from '@/lib/content/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  if (isInstore()) return [];
  return buildSitemap(siteOrigin(), routing.locales);
}
