/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useCallback } from 'react';
import type { UnitsResponse } from '@/lib/portal/types';
import { postJson, swrFetcher } from './http';

/** Units and stores of the associate for the switcher (loaded when the switcher opens). */
export function useUnits(enabled: boolean, businessUnitKey: string) {
  const { data, error, isLoading } = useSWR<UnitsResponse>(enabled ? ['units', businessUnitKey] : null, () => swrFetcher<UnitsResponse>('/api/business-units'), {
    revalidateOnFocus: false,
  });
  return { data, error, isLoading };
}

export interface SwitchResult {
  ok: boolean;
  name?: string;
  label?: string;
}

/**
 * Switches business unit and store: one session write on the server, then every unit-scoped SWR key is revalidated.
 * Keys that are not unit scoped (a plain string key) are untouched; unit-scoped keys are tuples whose second element
 * is the business unit key (`['orders', businessUnitKey]`).
 */
export function useSwitchUnit() {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (businessUnitKey: string, storeKey?: string): Promise<SwitchResult> => {
      const result = await postJson<{ name: string; label: string }>('/api/business-units/select', { businessUnitKey, storeKey });
      if (!result.ok || !result.data) return { ok: false };
      await mutate((key) => Array.isArray(key) && key.length >= 2 && typeof key[1] === 'string' && key[0] !== 'units', undefined, { revalidate: true });
      return { ok: true, name: result.data.name, label: result.data.label };
    },
    [mutate],
  );
}
