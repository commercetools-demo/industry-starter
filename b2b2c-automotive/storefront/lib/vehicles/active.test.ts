// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Garage } from '@/lib/types';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';

const readGarage = vi.hoisted(() => vi.fn());
const tableGet = vi.hoisted(() => vi.fn());

// `cache()` of React only memoises inside a server render; the test stands in with a per-module memo of the same shape.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T,>(fn: () => Promise<T>) => {
    let memo: Promise<T> | undefined;
    return () => (memo ??= fn());
  },
}));
vi.mock('@/lib/vehicles/service', () => ({ readGarage }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { customObjects: () => ({ get: () => ({ execute: tableGet }) }) }, projectKey: 'p' }));

const garage = (year: number): Garage => ({
  vehicles: [{ id: `volkswagen.golf.${year}.2-0-tdi`, make: 'Volkswagen', model: 'Golf', year, engine: '2.0 TDI', fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI' }],
  activeId: `volkswagen.golf.${year}.2-0-tdi`,
});

beforeEach(() => {
  vi.resetModules();
  readGarage.mockReset();
  tableGet.mockReset();
  tableGet.mockResolvedValue({ body: { results: VEHICLE_RECORDS.map((r) => ({ id: r.fitmentKey, version: 1, container: 'mau-vehicles', key: 'k', value: r })) } });
});

describe('getActiveVehicle (server helper for pages)', () => {
  it('returns fit keys for the active vehicle', async () => {
    readGarage.mockResolvedValue(garage(2019));
    const { getActiveVehicle } = await import('./active');
    const vehicle = await getActiveVehicle();
    expect(vehicle).toMatchObject({ id: 'volkswagen.golf.2019.2-0-tdi', label: '2019 Volkswagen Golf · 2.0 TDI' });
    expect(vehicle?.fitKeys).toEqual(['Volkswagen|Golf|2012|2019|2.0 TDI', 'Volkswagen|Golf|2019|2024|2.0 TDI']);
  });

  it('second call in one request reads once', async () => {
    readGarage.mockResolvedValue(garage(2016));
    const { getActiveVehicle } = await import('./active');
    await getActiveVehicle();
    await getActiveVehicle();
    expect(readGarage).toHaveBeenCalledTimes(1);
    expect(tableGet).toHaveBeenCalledTimes(1);
  });

  it('is null without a garage', async () => {
    readGarage.mockResolvedValue({ vehicles: [], activeId: null });
    const { getActiveVehicle } = await import('./active');
    expect(await getActiveVehicle()).toBeNull();
  });
});
