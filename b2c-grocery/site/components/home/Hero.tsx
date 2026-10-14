/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { HomeLayout } from '@/lib/config/site';
import { HeroEditorial } from './HeroEditorial';
import { HeroGrid } from './HeroGrid';

/** Renders exactly one hero variant; the sections below do not depend on it. */
export function Hero({ layout, imageUrl }: { layout: HomeLayout; imageUrl: string }) {
  return layout === 'grid' ? <HeroGrid /> : <HeroEditorial imageUrl={imageUrl} />;
}
