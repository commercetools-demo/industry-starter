import type { MetadataRoute } from 'next';
import { isInstore } from '@/lib/app-mode';
import { siteOrigin } from '@/lib/content/seo';

/** Crawlers may read the shop; the API and the per-person pages (account, cart, checkout) stay out. */
const DISALLOWED = ['/api/', '/*/account', '/*/cart', '/*/checkout'];

export default function robots(): MetadataRoute.Robots {
  // The In-store companion is not for search engines (workstream R, D-048).
  if (isInstore()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: DISALLOWED },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
