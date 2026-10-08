import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { buildRobots } from '@/lib/sitemap';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl());
}
