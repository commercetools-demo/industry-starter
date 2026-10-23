import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { buildSitemap } from '@/lib/content/sitemap';
import { siteOrigin } from '@/lib/content/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteOrigin(), routing.locales);
}
