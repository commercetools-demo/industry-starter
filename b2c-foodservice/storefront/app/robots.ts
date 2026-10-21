import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/content/seo';

/** Crawlers may read the shop; the API and the per-person pages (account, cart, checkout) stay out. */
const DISALLOWED = ['/api/', '/*/account', '/*/cart', '/*/checkout'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: DISALLOWED },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
