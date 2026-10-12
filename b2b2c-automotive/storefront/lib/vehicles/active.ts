// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { cache } from 'react';
import { expandKeysFor } from '@/lib/ct/vehicles';
import type { Vehicle } from '@/lib/types';
import { toVehicle } from './garage';
import { readGarage } from './service';

export type ActiveVehicle = Vehicle & {
  /** The range keys the vehicle fits (usually one, two where generations overlap): pass to `fitScope` from `@/lib/search/fitment`. */
  fitKeys: string[];
};

/**
 * The active vehicle with its expanded fitment keys, or null. For pages of K, L and M (Server Components and Route Handlers):
 * the garage (cookie or customer field) and the vehicle table are read once per request.
 *   const vehicle = await getActiveVehicle();
 *   const scope = fitScope(vehicle?.fitKeys ?? null, resolveFitMode(vehicle, searchParams.fit));
 */
export const getActiveVehicle = cache(async (): Promise<ActiveVehicle | null> => {
  const garage = await readGarage();
  const entry = garage.vehicles.find((v) => v.id === garage.activeId);
  if (!entry) return null;
  return { ...toVehicle(entry), fitKeys: await expandKeysFor(entry) };
});
