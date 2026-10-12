// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale } from 'next-intl';
import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetch-json';
import { keyBranches } from '@/lib/cache-keys';
import type { BranchesResponse } from '@/lib/types';

/** Branches of the session's store with hours state and pickup option. The layout seeds the cache, so the first render has data. */
export function useBranches(): { data: BranchesResponse | undefined; isLoading: boolean } {
  const locale = useLocale();
  const { data, isLoading } = useSWR<BranchesResponse>(keyBranches(locale), fetchJson, { revalidateOnFocus: false, shouldRetryOnError: false });
  return { data, isLoading };
}
