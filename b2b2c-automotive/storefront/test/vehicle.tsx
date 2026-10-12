// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Test helpers for the vehicle components (workstream J): an in-memory fake of /api/garage, /api/vehicles/options and
// /api/vehicles/lookup, and a render function with next-intl (real en-US messages), SWR and the garage context.
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { vi } from 'vitest';
import { GarageContext } from '@/context/GarageProvider';
import messages from '@/messages/en-US.json';
import type { Garage, GarageState } from '@/lib/types';
import { buildCatalog, findFitmentKeyFor, vehicleFromId } from '@/lib/vehicles/catalog';
import { addVehicle, removeVehicle, setActive, toGarageState } from '@/lib/vehicles/garage';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';
import type { LookupResult } from '@/lib/vehicles/provider';

export { messages };
export const emptyState: GarageState = { garage: { vehicles: [], activeId: null }, vehicles: [], active: null };

export function stateOf(...ids: string[]): GarageState {
  let garage: Garage = { vehicles: [], activeId: null };
  for (const id of ids) {
    const vehicle = vehicleFromId(VEHICLE_RECORDS, id);
    if (!vehicle) throw new Error(`fixture vehicle ${id} does not exist`);
    garage = addVehicle(garage, { id, make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine, fitmentKey: findFitmentKeyFor(VEHICLE_RECORDS, vehicle) ?? '' });
  }
  return toGarageState(garage);
}

export interface FakeApi {
  fetch: ReturnType<typeof vi.fn>;
  state: () => GarageState;
  calls: () => string[];
  /** The next lookup answers with this result. */
  lookup: (result: LookupResult) => void;
}

/** Installs the fake as global fetch. Call `vi.unstubAllGlobals()` in afterEach. */
export function installFakeApi(initial: GarageState = emptyState, options: { failOptions?: boolean; failGarage?: boolean } = {}): FakeApi {
  let garage = initial.garage;
  let lookupResult: LookupResult = { status: 'not-found' };
  const calls: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.pathname}${url.search}`);
    if (url.pathname === '/api/vehicles/options') {
      if (options.failOptions) return json({ error: 'x' }, 500);
      const q = url.searchParams;
      const catalog = buildCatalog(VEHICLE_RECORDS, q.get('market') ?? undefined);
      const make = q.get('make');
      const model = q.get('model');
      const year = q.get('year');
      if (!make) return json({ level: 'make', options: catalog.makes() });
      if (!model) return json({ level: 'model', options: catalog.models(make) ?? [] });
      if (!year) return json({ level: 'year', options: (catalog.years(make, model) ?? []).map((y) => ({ key: String(y), label: String(y) })) });
      return json({ level: 'engine', options: catalog.engines(make, model, Number(year)) ?? [] });
    }
    if (url.pathname === '/api/vehicles/lookup') return json(lookupResult);
    if (url.pathname.startsWith('/api/garage')) {
      if (options.failGarage && method !== 'GET') return json({ error: 'x' }, 500);
      if (method === 'POST' && url.pathname === '/api/garage') {
        const { vehicleId } = JSON.parse(String(init?.body)) as { vehicleId: string };
        const vehicle = vehicleFromId(VEHICLE_RECORDS, vehicleId);
        if (!vehicle) return json({ error: 'Unknown vehicle' }, 400);
        garage = addVehicle(garage, { id: vehicleId, make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine, fitmentKey: findFitmentKeyFor(VEHICLE_RECORDS, vehicle) ?? '' });
      } else if (method === 'POST' && url.pathname === '/api/garage/active') {
        garage = setActive(garage, (JSON.parse(String(init?.body)) as { vehicleId: string }).vehicleId);
      } else if (method === 'DELETE') {
        garage = removeVehicle(garage, url.searchParams.get('vehicleId') ?? '');
      }
      return json(toGarageState(garage));
    }
    return json({ error: 'not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetch: fetchMock, state: () => toGarageState(garage), calls: () => calls, lookup: (r) => void (lookupResult = r) };
}

export interface RenderOptions {
  garage?: GarageState;
  lookupEnabled?: boolean;
  onChange?: () => void;
  locale?: string;
}

/**
 * Renders with the real en-US messages (texts are asserted in English) under the de-DE locale by default (market DE, which has the
 * Volkswagen Golf of the fixtures), an isolated SWR cache seeded with `garage` (the server read) and the garage context. */
export function renderVehicle(ui: ReactElement, { garage = emptyState, lookupEnabled = false, onChange, locale = 'de-DE' }: RenderOptions = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback: { '/api/garage': garage } }}>
        <GarageContext.Provider value={{ lookupEnabled, onChange }}>{children}</GarageContext.Provider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}
