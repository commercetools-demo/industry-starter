// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The one heads-up banner (S-03, decision 4): derived from stock, never stored. Never throws.
import 'server-only';
import { countOutOfStockEverywhere } from './stock';
import type { HeadsUp } from '@/lib/dashboard/types';

/** T builds the filter this link opens; it starts with `/` and is rendered with the locale-aware Link. */
export const HEADS_UP_HREF = '/catalog?tab=assortment&stock=none';

export async function getHeadsUp(storeKey: string, count: (storeKey: string) => Promise<number> = countOutOfStockEverywhere): Promise<HeadsUp | null> {
  try {
    const n = await count(storeKey);
    return n > 0 ? { kind: 'out-of-stock-everywhere', count: n, href: HEADS_UP_HREF } : null;
  } catch {
    return null;
  }
}
