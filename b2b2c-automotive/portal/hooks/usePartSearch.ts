/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useEffect, useState } from 'react';
import { MIN_QUERY } from '@/lib/portal/search';
import type { PartHit } from '@/lib/portal/types';
import { getJson } from './http';

/** Debounced part search (200 ms) for the palette; nothing is requested below two characters. */
export function usePartSearch(query: string, storeKey: string, delayMs = 200) {
  const [parts, setParts] = useState<PartHit[]>([]);
  const q = query.trim();
  const active = q.length >= MIN_QUERY;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await getJson<{ parts: PartHit[] }>(`/api/search/parts?q=${encodeURIComponent(q)}`);
      if (!cancelled) setParts(result.ok && result.data ? result.data.parts : []);
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, active, storeKey, delayMs]);
  return active ? parts : [];
}

/** Looks a part up without debounce (Enter in the top bar). */
export async function lookupParts(query: string): Promise<PartHit[]> {
  const result = await getJson<{ parts: PartHit[] }>(`/api/search/parts?q=${encodeURIComponent(query.trim())}`);
  return result.ok && result.data ? result.data.parts : [];
}
