// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale } from 'next-intl';
import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetch-json';
import { KEY_VEHICLE_OPTIONS } from '@/lib/cache-keys';
import { isAppLocale } from '@/i18n/config';
import type { Selection } from '@/lib/vehicles/selectorReducer';
import { COUNTRY_CONFIG } from '@/lib/utils';

export interface VehicleOption {
  key: string;
  label: string;
  /** Engine level only. */
  vehicleId?: string;
}
interface OptionsResponse {
  level: string;
  options: VehicleOption[];
}

export function vehicleOptionsKey(query: Selection, market?: string): string {
  const params = new URLSearchParams();
  if (market) params.set('market', market);
  for (const level of ['make', 'model', 'year'] as const) if (query[level]) params.set(level, query[level]);
  const qs = params.toString();
  return qs ? `${KEY_VEHICLE_OPTIONS}?${qs}` : KEY_VEHICLE_OPTIONS;
}

/**
 * Options of one selector level. `query` null means the level is not available yet (nothing is fetched).
 * The market (DE or US) follows the locale, so a German shopper is not offered US-only trucks.
 */
export function useVehicleOptions(query: Selection | null): { options: VehicleOption[]; isLoading: boolean; error: unknown; retry: () => void } {
  const locale = useLocale();
  const market = isAppLocale(locale) ? COUNTRY_CONFIG[locale].country : undefined;
  const { data, error, isLoading, mutate } = useSWR<OptionsResponse>(query ? vehicleOptionsKey(query, market) : null, fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return { options: data?.options ?? [], isLoading, error, retry: () => void mutate() };
}
