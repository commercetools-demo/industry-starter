/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

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
