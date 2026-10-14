/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** Banner slots consumed by site/content/images.ts (not stored in commercetools). One photo per slot. */
export interface SiteSlot { slot: string }

export const SITE_SLOTS: SiteSlot[] = [
  { slot: 'home-hero' },
  { slot: 'home-cta' },
  { slot: 'home-rx-delivery' },
  { slot: 'journal-1' },
  { slot: 'journal-2' },
  { slot: 'journal-3' },
];
