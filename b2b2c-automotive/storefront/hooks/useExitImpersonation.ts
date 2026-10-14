// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { postJson } from '@/hooks/fetch-json';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';

/**
 * `POST /api/impersonate/exit` (V-06): ends the "Shop as customer" session. `exit` resolves to whether it worked; on success the account and
 * cart caches are cleared so nothing of the customer stays on screen.
 */
export function useExitImpersonation(): { exit: () => Promise<boolean>; isExiting: boolean; failed: boolean } {
  const { mutate } = useSWRConfig();
  const [isExiting, setExiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const exit = useCallback(async () => {
    setExiting(true);
    setFailed(false);
    try {
      await postJson<{ ok: true }>('/api/impersonate/exit', {});
      await mutate((key) => typeof key === 'string' && (key === KEY_ACCOUNT || key.startsWith(KEY_CART)), undefined, { revalidate: false });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setExiting(false);
    }
  }, [mutate]);
  return { exit, isExiting, failed };
}
