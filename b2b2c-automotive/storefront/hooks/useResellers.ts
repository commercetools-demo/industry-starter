// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetch-json';
import { keyResellers } from '@/lib/cache-keys';
import type { Reseller } from '@/lib/malva-types';

/** The resellers of the Malva finder (`GET /api/resellers`); the same list for everyone, so it is not revalidated on focus. */
export function useResellers(locale: string): { resellers: Reseller[] | undefined; isLoading: boolean; error: boolean; retry: () => void } {
  const { data, isLoading, error, mutate } = useSWR<{ resellers: Reseller[] }>(keyResellers(locale), fetchJson, { revalidateOnFocus: false, shouldRetryOnError: false });
  return { resellers: data?.resellers, isLoading, error: Boolean(error), retry: () => void mutate() };
}
