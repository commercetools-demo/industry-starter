// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { postJson } from '@/hooks/fetch-json';
import { KEY_BRANCHES, KEY_CART } from '@/lib/cache-keys';

/**
 * Stores the chosen branch in the session, then refreshes what depends on it: the branch list (header chip) and every
 * cart read (the cart is re-priced by the branch). Callers refresh server-rendered pages with `router.refresh()`.
 */
export function useSelectBranch(): (branchKey: string) => Promise<{ ok: true; cartRepriced: boolean }> {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (branchKey: string) => {
      const result = await postJson<{ ok: true; cartRepriced: boolean }>('/api/store-context/branch', { branchKey });
      await mutate((key) => typeof key === 'string' && (key.startsWith(KEY_BRANCHES) || key.startsWith(KEY_CART)));
      return result;
    },
    [mutate],
  );
}
