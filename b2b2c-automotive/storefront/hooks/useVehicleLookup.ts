// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback } from 'react';
import { postJson } from '@/hooks/fetch-json';
import type { LookupResult, PlateCountry } from '@/lib/vehicles/provider';

export type LookupInput = { type: 'plate'; plate: string; country: PlateCountry } | { type: 'vin'; vin: string };

/**
 * Plate and VIN lookup (the mock provider, "Demo lookup"). Resolves to a `LookupResult`; a network failure or a 429 is reported
 * as `{ status: 'unavailable' }`. Nothing is saved: saving is the shopper's confirmation (`useGarage().addVehicle`).
 */
export function useVehicleLookup(): (input: LookupInput) => Promise<LookupResult> {
  return useCallback(async (input) => {
    try {
      return await postJson<LookupResult>('/api/vehicles/lookup', input);
    } catch {
      return { status: 'unavailable' };
    }
  }, []);
}
