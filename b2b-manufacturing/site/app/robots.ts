import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { LOCALES } from '@/lib/utils';

/** Public paths are crawlable; the portal, auth pages and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', ...LOCALES.map((l) => `/${l}/account`)] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
