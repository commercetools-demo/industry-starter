// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageContext } from '@/context/GarageProvider';
import type { Garage, GarageState, GarageVehicle } from '@/lib/types';
import { toGarageState } from '@/lib/vehicles/garage';
import { useGarage } from './useGarage';

const v = (id: string, make: string, model: string, year: number, engine: string): GarageVehicle => ({ id, make, model, year, engine, fitmentKey: 'k' });
const golf = v('volkswagen.golf.2016.2-0-tdi', 'Volkswagen', 'Golf', 2016, '2.0 TDI');
const a3 = v('audi.a3.2018.1-4-tfsi', 'Audi', 'A3', 2018, '1.4 TFSI');
const state = (vehicles: GarageVehicle[], activeId: string | null): GarageState => toGarageState({ vehicles, activeId } as Garage);

let server: GarageState;
const fetchMock = vi.fn();
const onChange = vi.fn();

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <GarageContext.Provider value={{ lookupEnabled: false, onChange }}>{children}</GarageContext.Provider>
  </SWRConfig>
);

beforeEach(() => {
  server = state([golf], golf.id);
  fetchMock.mockReset();
  onChange.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST' && url === '/api/garage') {
      const { vehicleId } = JSON.parse(String(init?.body)) as { vehicleId: string };
      const added = vehicleId === a3.id ? a3 : golf;
      server = state([...server.garage.vehicles.filter((x) => x.id !== added.id), added], added.id);
    } else if (method === 'POST' && url === '/api/garage/active') {
      const { vehicleId } = JSON.parse(String(init?.body)) as { vehicleId: string };
      server = state(server.garage.vehicles, vehicleId);
    } else if (method === 'DELETE') {
      const id = new URL(url, 'http://x').searchParams.get('vehicleId');
      const rest = server.garage.vehicles.filter((x) => x.id !== id);
      server = state(rest, rest.some((x) => x.id === server.garage.activeId) ? server.garage.activeId : (rest.at(-1)?.id ?? null));
    }
    return new Response(JSON.stringify(server), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('useGarage', () => {
  it('reads the garage', async () => {
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.active?.id).toBe(golf.id);
    expect(result.current.vehicles).toHaveLength(1);
    expect(result.current.isFull).toBe(false);
  });

  it('addVehicle makes it active', async () => {
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.addVehicle(a3.id);
    });
    expect(result.current.active?.id).toBe(a3.id);
    expect(result.current.vehicles.map((x) => x.id)).toEqual([golf.id, a3.id]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('setActive switches', async () => {
    server = state([golf, a3], a3.id);
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.active?.id).toBe(a3.id));
    await act(async () => {
      await result.current.setActive(golf.id);
    });
    expect(result.current.active?.id).toBe(golf.id);
    expect(onChange).toHaveBeenCalled();
  });

  it('remove updates the list', async () => {
    server = state([golf, a3], a3.id);
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.vehicles).toHaveLength(2));
    await act(async () => {
      await result.current.remove(a3.id);
    });
    expect(result.current.vehicles.map((x) => x.id)).toEqual([golf.id]);
    expect(result.current.active?.id).toBe(golf.id);
  });

  it('rolls back an optimistic change when the server refuses', async () => {
    server = state([golf, a3], a3.id);
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.vehicles).toHaveLength(2));
    fetchMock.mockImplementationOnce(async () => new Response('{"error":"x"}', { status: 500 }));
    await act(async () => {
      await expect(result.current.setActive(golf.id)).rejects.toThrow();
    });
    expect(result.current.active?.id).toBe(a3.id);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a full garage', async () => {
    server = state(['a', 'b', 'c', 'd', 'e'].map((x) => v(`m.m.2016.${x}`, 'M', 'M', 2016, x)), 'm.m.2016.a');
    const { result } = renderHook(() => useGarage(), { wrapper });
    await waitFor(() => expect(result.current.isFull).toBe(true));
  });
});
