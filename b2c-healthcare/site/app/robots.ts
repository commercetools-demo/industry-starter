/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { buildRobots } from '@/lib/sitemap';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl());
}
