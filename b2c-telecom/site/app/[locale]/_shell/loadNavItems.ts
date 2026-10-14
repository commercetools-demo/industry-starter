/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getCategoryTree } from '@/lib/ct/categories';
import { buildNavItems, type NavItem } from '@/lib/nav';
import type { Locale } from '@/lib/types';

/**
 * Root categories as nav items for the header, drawer, footer and the 404 page.
 * A catalog outage must never take the frame down: on any failure it logs and returns no items.
 * The tree itself is cached by H (60 s) and contains no session data.
 */
export async function loadNavItems(locale: Locale): Promise<NavItem[]> {
  try {
    return buildNavItems(await getCategoryTree(locale), locale);
  } catch {
    console.error('[shell] category tree unavailable');
    return [];
  }
}
