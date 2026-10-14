/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import useSWR from 'swr';
import { KEY_BUSINESS_UNITS } from '@/lib/cache-keys';
import { readJson, sendJson } from '@/lib/fetcher';
import type { BusinessUnitSummary } from '@/lib/types';
import { useAccount } from './useAccount';

export function useBusinessUnits() {
  const { account } = useAccount();
  const { data, isLoading, mutate } = useSWR(account ? KEY_BUSINESS_UNITS : null, () => readJson<{ businessUnits: BusinessUnitSummary[]; current: string | null }>('/api/business-units'));
  return { businessUnits: data?.businessUnits ?? [], current: data?.current ?? null, isLoading, mutate };
}

/** Throws on failure; the caller then clears the other company's entries (lib/client-state.ts). */
export const selectBusinessUnit = (businessUnitKey: string) => sendJson<{ businessUnitKey: string }>('/api/business-units/select', 'POST', { businessUnitKey });
