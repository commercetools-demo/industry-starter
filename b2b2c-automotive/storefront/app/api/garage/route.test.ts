// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Garage, GarageState } from '@/lib/types';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>(), sets: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>, deletes: [] as string[] }));
const session = vi.hoisted(() => ({ current: {} as { customerId?: string } }));
const tableGet = vi.hoisted(() => vi.fn());
const customerGet = vi.hoisted(() => vi.fn());
const customerPost = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.sets.push({ name, value, options });
      jar.values.set(name, value);
    },
    delete: (name: string) => {
      jar.deletes.push(name);
      jar.values.delete(name);
    },
  }),
}));
vi.mock('@/lib/session', () => ({ getSession: async () => session.current }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customObjects: () => ({ get: () => ({ execute: tableGet }) }),
    customers: () => ({ withId: () => ({ get: () => ({ execute: customerGet }), post: (args: unknown) => ({ execute: () => customerPost(args) }) }) }),
  },
  projectKey: 'p',
}));

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const stored = () => JSON.parse(jar.values.get('garage') ?? 'null') as Garage;

async function routes() {
  const [root, active, merge] = await Promise.all([import('./route'), import('./active/route'), import('./merge/route')]);
  return { root, active, merge };
}
async function add(vehicleId: string, nickname?: string) {
  const { root } = await routes();
  return root.POST(makeRequest('/api/garage', json({ vehicleId, nickname })));
}

beforeEach(() => {
  vi.resetModules();
  jar.values.clear();
  jar.sets.length = 0;
  jar.deletes.length = 0;
  session.current = {};
  tableGet.mockReset();
  customerGet.mockReset();
  customerPost.mockReset();
  tableGet.mockResolvedValue({ body: { results: VEHICLE_RECORDS.map((r) => ({ id: r.fitmentKey, version: 1, container: 'mau-vehicles', key: 'k', value: r })) } });
});

describe('Garage BFF: anonymous (cookie)', () => {
  it('an empty garage is returned for a shopper without a cookie', async () => {
    const { root } = await routes();
    const res = await root.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ garage: { vehicles: [], activeId: null }, vehicles: [], active: null });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('rejects an unknown vehicle id', async () => {
    const res = await add('volkswagen.golf.2011.2-0-tdi');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unknown vehicle' });
    expect(jar.sets).toHaveLength(0);
    expect((await add('Not An Id')).status).toBe(400);
    expect((await add('nope.nope.2016.x')).status).toBe(400);
  });

  it('anonymous add sets the cookie', async () => {
    const res = await add('volkswagen.golf.2016.2-0-tdi');
    expect(res.status).toBe(200);
    const body = (await res.json()) as GarageState;
    expect(body.active).toEqual({ id: 'volkswagen.golf.2016.2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI' });
    const [cookie] = jar.sets;
    expect(cookie.name).toBe('garage');
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 });
    expect(stored().vehicles[0]).toMatchObject({ fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI' });
    expect(customerPost).not.toHaveBeenCalled();
  });

  it('adds up to five, the sixth drops the oldest', async () => {
    for (const id of ['volkswagen.golf.2016.2-0-tdi', 'audi.a3.2018.1-4-tfsi', 'opel.astra.2019.1-4-turbo', 'bmw.3-series.2017.320d', 'renault.clio.2021.1-0-tce', 'ford.focus.2020.1-0-ecoboost']) await add(id);
    const { root } = await routes();
    const body = (await (await root.GET()).json()) as GarageState;
    expect(body.vehicles).toHaveLength(5);
    expect(body.vehicles[0].id).toBe('audi.a3.2018.1-4-tfsi');
    expect(body.active?.id).toBe('ford.focus.2020.1-0-ecoboost');
  });

  it('stores an optional nickname and rejects a long one', async () => {
    await add('volkswagen.golf.2016.2-0-tdi', 'Daily');
    expect(stored().vehicles[0].nickname).toBe('Daily');
    expect((await add('audi.a3.2018.1-4-tfsi', 'x'.repeat(41))).status).toBe(400);
  });

  it('an invalid body is 400', async () => {
    const { root } = await routes();
    const res = await root.POST(makeRequest('/api/garage', { method: 'POST', body: '{"vehicleId":5}', headers: { 'content-type': 'application/json' } }));
    expect(res.status).toBe(400);
  });

  it('a damaged cookie yields an empty garage', async () => {
    jar.values.set('garage', '{broken');
    const { root } = await routes();
    expect((await (await root.GET()).json()) as GarageState).toMatchObject({ vehicles: [], active: null });
  });

  it('cookie entries are re-validated against the table on read', async () => {
    jar.values.set('garage', JSON.stringify({ vehicles: [{ id: 'x', make: 'Volkswagen', model: 'Golf', year: 2030, engine: '2.0 TDI', fitmentKey: 'k' }], activeId: 'x' }));
    const { root } = await routes();
    expect(((await (await root.GET()).json()) as GarageState).vehicles).toEqual([]);
  });

  it('delete of the active vehicle activates the newest remaining', async () => {
    await add('volkswagen.golf.2016.2-0-tdi');
    await add('audi.a3.2018.1-4-tfsi');
    await add('opel.astra.2019.1-4-turbo');
    const { root } = await routes();
    const res = await root.DELETE(makeRequest('/api/garage?vehicleId=opel.astra.2019.1-4-turbo', { method: 'DELETE' }));
    const body = (await res.json()) as GarageState;
    expect(body.vehicles.map((v) => v.id)).toEqual(['volkswagen.golf.2016.2-0-tdi', 'audi.a3.2018.1-4-tfsi']);
    expect(body.active?.id).toBe('audi.a3.2018.1-4-tfsi');
    expect((await root.DELETE(makeRequest('/api/garage', { method: 'DELETE' }))).status).toBe(400);
  });

  it('removing the last vehicle deletes the cookie', async () => {
    await add('volkswagen.golf.2016.2-0-tdi');
    const { root } = await routes();
    await root.DELETE(makeRequest('/api/garage?vehicleId=volkswagen.golf.2016.2-0-tdi', { method: 'DELETE' }));
    expect(jar.deletes).toContain('garage');
  });

  it('set active switches and refuses a vehicle that is not in the garage', async () => {
    await add('volkswagen.golf.2016.2-0-tdi');
    await add('audi.a3.2018.1-4-tfsi');
    const { active } = await routes();
    const ok = await active.POST(makeRequest('/api/garage/active', json({ vehicleId: 'volkswagen.golf.2016.2-0-tdi' })));
    expect(((await ok.json()) as GarageState).active?.id).toBe('volkswagen.golf.2016.2-0-tdi');
    const bad = await active.POST(makeRequest('/api/garage/active', json({ vehicleId: 'opel.astra.2019.1-4-turbo' })));
    expect(bad.status).toBe(404);
  });

  it('a table outage answers 500 without details', async () => {
    tableGet.mockRejectedValue({ statusCode: 503, message: 'secret detail' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await add('volkswagen.golf.2016.2-0-tdi');
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret');
  });
});

describe('Garage BFF: signed in (customer field)', () => {
  const customer = (garage: Garage | null, version = 2) => ({
    body: { id: 'c1', version, custom: { type: { typeId: 'type', id: 't' }, fields: garage ? { garage: JSON.stringify(garage) } : {} } },
  });

  it('signed-in add writes the customer field and not the cookie', async () => {
    session.current = { customerId: 'c1' };
    customerGet.mockResolvedValue(customer(null));
    customerPost.mockResolvedValue({ body: {} });
    const res = await add('volkswagen.golf.2016.2-0-tdi');
    expect(res.status).toBe(200);
    const sent = customerPost.mock.calls[0][0] as { body: { version: number; actions: Array<{ action: string; name: string; value: string }> } };
    expect(sent.body.actions[0]).toMatchObject({ action: 'setCustomField', name: 'garage' });
    expect(JSON.parse(sent.body.actions[0].value).activeId).toBe('volkswagen.golf.2016.2-0-tdi');
    expect(jar.sets).toHaveLength(0);
  });

  it('GET reads the customer field', async () => {
    session.current = { customerId: 'c1' };
    customerGet.mockResolvedValue(
      customer({ vehicles: [{ id: 'audi-a3-2018-1-4-tfsi', make: 'Audi', model: 'A3', year: 2018, engine: '1.4 TFSI', fitmentKey: 'Audi|A3|2012|2020|1.4 TFSI' }], activeId: 'audi-a3-2018-1-4-tfsi' }),
    );
    const { root } = await routes();
    const body = (await (await root.GET()).json()) as GarageState;
    expect(body.active?.label).toBe('2018 Audi A3 · 1.4 TFSI');
  });

  it('merge route needs a session customer', async () => {
    const { merge } = await routes();
    const res = await merge.POST();
    expect(res.status).toBe(401);
    expect(customerGet).not.toHaveBeenCalled();
  });

  it('merge route merges the cookie garage into the account and clears the cookie', async () => {
    jar.values.set(
      'garage',
      JSON.stringify({ vehicles: [{ id: 'opel.astra.2019.1-4-turbo', make: 'Opel', model: 'Astra', year: 2019, engine: '1.4 Turbo', fitmentKey: 'Opel|Astra|2015|2021|1.4 Turbo' }], activeId: 'opel.astra.2019.1-4-turbo' }),
    );
    session.current = { customerId: 'c1' };
    customerGet.mockResolvedValue(
      customer({ vehicles: [{ id: 'volkswagen.golf.2016.2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI' }], activeId: 'volkswagen.golf.2016.2-0-tdi' }),
    );
    customerPost.mockResolvedValue({ body: {} });
    const { merge } = await routes();
    const res = await merge.POST();
    const body = (await res.json()) as GarageState;
    expect(body.vehicles.map((v) => v.id)).toEqual(['volkswagen.golf.2016.2-0-tdi', 'opel.astra.2019.1-4-turbo']);
    expect(body.active?.id).toBe('opel.astra.2019.1-4-turbo');
    expect(jar.deletes).toContain('garage');
  });
});
