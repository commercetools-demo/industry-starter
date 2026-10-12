// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useContext } from 'react';
import useSWR from 'swr';
import { GarageContext } from '@/context/GarageProvider';
import { fetchJson, postJson } from '@/hooks/fetch-json';
import { KEY_GARAGE } from '@/lib/cache-keys';
import type { GarageState, Vehicle, VehicleId } from '@/lib/types';
import { GARAGE_MAX, removeVehicle, setActive as activate, toGarageState } from '@/lib/vehicles/garage';

export interface UseGarage {
  garage: GarageState['garage'] | undefined;
  vehicles: Vehicle[];
  active: Vehicle | null;
  isLoading: boolean;
  /** The garage could not be read (the server read of the first paint normally prevents this). */
  error: unknown;
  /** Five vehicles: adding another drops the oldest one that is not active. */
  isFull: boolean;
  /** Adds (validated on the server) and activates. Throws when the server refuses. */
  addVehicle: (vehicleId: VehicleId, nickname?: string) => Promise<GarageState>;
  /** Optimistic; rolls back and throws when the server refuses. */
  setActive: (vehicleId: VehicleId) => Promise<void>;
  /** Optimistic; removing the active vehicle activates the newest remaining one. */
  remove: (vehicleId: VehicleId) => Promise<void>;
}

/**
 * The shopper's garage. `GarageProvider` seeds the cache from the server read, so `data` is there on first render.
 * Every change refreshes server-rendered pages through the provider (`router.refresh()`), so listings and product pages
 * re-read the active vehicle. Components never call `/api/garage` themselves.
 */
export function useGarage(): UseGarage {
  const { onChange } = useContext(GarageContext);
  const { data, error, isLoading, mutate } = useSWR<GarageState>(KEY_GARAGE, fetchJson, { revalidateOnFocus: false });

  const addVehicle = useCallback(
    async (vehicleId: VehicleId, nickname?: string) => {
      const next = await postJson<GarageState>(KEY_GARAGE, nickname ? { vehicleId, nickname } : { vehicleId });
      await mutate(next, { revalidate: false });
      onChange?.();
      return next;
    },
    [mutate, onChange],
  );

  const setActive = useCallback(
    async (vehicleId: VehicleId) => {
      await mutate(postJson<GarageState>(`${KEY_GARAGE}/active`, { vehicleId }), {
        optimisticData: data ? toGarageState(activate(data.garage, vehicleId)) : undefined,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      });
      onChange?.();
    },
    [data, mutate, onChange],
  );

  const remove = useCallback(
    async (vehicleId: VehicleId) => {
      await mutate(fetchJson<GarageState>(`${KEY_GARAGE}?vehicleId=${encodeURIComponent(vehicleId)}`, { method: 'DELETE' }), {
        optimisticData: data ? toGarageState(removeVehicle(data.garage, vehicleId)) : undefined,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      });
      onChange?.();
    },
    [data, mutate, onChange],
  );

  return {
    garage: data?.garage,
    vehicles: data?.vehicles ?? [],
    active: data?.active ?? null,
    isLoading,
    error,
    isFull: (data?.vehicles.length ?? 0) >= GARAGE_MAX,
    addVehicle,
    setActive,
    remove,
  };
}
