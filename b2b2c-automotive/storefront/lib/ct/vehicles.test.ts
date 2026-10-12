// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';
import type { Garage, GarageVehicle } from '@/lib/types';
import { findFitmentKeyFor } from '@/lib/vehicles/catalog';
import { buildVehicleId } from '@/lib/vehicles/id';

const tableGet = vi.hoisted(() => vi.fn());
const customerGet = vi.hoisted(() => vi.fn());
const customerPost = vi.hoisted(() => vi.fn());
const withId = vi.hoisted(() => vi.fn(() => ({ get: () => ({ execute: customerGet }), post: (args: unknown) => ({ execute: () => customerPost(args) }) })));
vi.mock('./client', () => ({
  apiRoot: {
    customObjects: () => ({ get: (args: unknown) => ({ execute: () => tableGet(args) }) }),
    customers: () => ({ withId }),
  },
  projectKey: 'p',
}));

const tableBody = () => ({
  body: {
    results: VEHICLE_RECORDS.map((r) => ({ id: r.fitmentKey, version: 1, container: 'mau-vehicles', key: `mau-veh-${r.fitmentKey}`, value: r })),
  },
});

const entry = (make: string, model: string, year: number, engine: string): GarageVehicle => ({
  id: buildVehicleId({ make, model, year, engine }),
  make,
  model,
  year,
  engine,
  fitmentKey: findFitmentKeyFor(VEHICLE_RECORDS, { make, model, year, engine }) ?? '',
});
const golf = entry('Volkswagen', 'Golf', 2016, '2.0 TDI');
const a3 = entry('Audi', 'A3', 2018, '1.4 TFSI');
const astra = entry('Opel', 'Astra', 2019, '1.4 Turbo');

const customer = (garage: Garage | null, version = 3, withType = true) => ({
  body: {
    id: 'c1',
    version,
    ...(withType ? { custom: { type: { typeId: 'type', id: 't1' }, fields: { garage: garage ? JSON.stringify(garage) : undefined, mobile: '123' } } } : {}),
  },
});

async function load() {
  return import('./vehicles');
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  tableGet.mockReset();
  customerGet.mockReset();
  customerPost.mockReset();
  tableGet.mockResolvedValue(tableBody());
});
afterEach(() => vi.useRealTimers());

describe('Vehicle table read model', () => {
  it('reads the container once with the documented query', async () => {
    const { listVehicleRecords } = await load();
    const records = await listVehicleRecords();
    expect(records).toHaveLength(26);
    expect(tableGet).toHaveBeenCalledWith({ queryArgs: { where: 'container="mau-vehicles"', limit: 500 } });
  });

  it('one table read for many ids', async () => {
    const { resolveVehicles } = await load();
    const vehicles = await resolveVehicles(['volkswagen.golf.2016.2-0-tdi', 'audi.a3.2018.1-4-tfsi', 'nope.nope.2000.x']);
    expect(vehicles.map((v) => v.label)).toEqual(['2016 Volkswagen Golf · 2.0 TDI', '2018 Audi A3 · 1.4 TFSI']);
    expect(tableGet).toHaveBeenCalledTimes(1);
  });

  it('unknown id returns null and a year outside every range returns null', async () => {
    const { getVehicleById } = await load();
    expect(await getVehicleById('volkswagen.golf.2016.9-9')).toBeNull();
    expect(await getVehicleById('volkswagen.golf.2011.2-0-tdi')).toBeNull();
    expect(await getVehicleById('garbage')).toBeNull();
    expect((await getVehicleById('volkswagen.golf.2019.2-0-tdi'))?.year).toBe(2019);
  });

  it('is cached for an hour', async () => {
    const { listVehicleRecords } = await load();
    await listVehicleRecords();
    await listVehicleRecords();
    expect(tableGet).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_600_001);
    await listVehicleRecords();
    expect(tableGet).toHaveBeenCalledTimes(2);
  });

  it('serves the last table when commercetools is down', async () => {
    const { listVehicleRecords } = await load();
    await listVehicleRecords();
    vi.advanceTimersByTime(3_600_001);
    tableGet.mockRejectedValue({ statusCode: 503 });
    expect(await listVehicleRecords()).toHaveLength(26);
  });

  it('without a table the error is thrown', async () => {
    tableGet.mockRejectedValue({ statusCode: 503 });
    const { listVehicleRecords } = await load();
    await expect(listVehicleRecords()).rejects.toMatchObject({ statusCode: 503 });
  });

  it('skips malformed table objects', async () => {
    tableGet.mockResolvedValue({ body: { results: [...tableBody().body.results, { id: 'x', value: { make: 1 } }] } });
    const { listVehicleRecords } = await load();
    expect(await listVehicleRecords()).toHaveLength(26);
  });

  it('expands the active vehicle to its range keys', async () => {
    const { expandKeysFor } = await load();
    expect(await expandKeysFor({ make: 'Volkswagen', model: 'Golf', year: 2019, engine: '2.0 TDI' })).toHaveLength(2);
  });
});

describe('Customer garage', () => {
  it('reads and normalises the garage custom field', async () => {
    customerGet.mockResolvedValue(
      customer({ vehicles: [{ ...golf, id: 'volkswagen-golf-2016-2-0-tdi' }], activeId: 'volkswagen-golf-2016-2-0-tdi' }),
    );
    const { readCustomerGarage } = await load();
    const read = await readCustomerGarage('c1');
    expect(read.garage.vehicles.map((v) => v.id)).toEqual([golf.id]);
    expect(read.garage.activeId).toBe(golf.id);
    expect(withId).toHaveBeenCalledWith({ ID: 'c1' });
  });

  it('a customer without the field has an empty garage', async () => {
    customerGet.mockResolvedValue(customer(null, 1, false));
    const { readCustomerGarage } = await load();
    expect((await readCustomerGarage('c1')).garage).toEqual({ vehicles: [], activeId: null });
  });

  it('signed-in add writes the customer field with setCustomField', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf], activeId: golf.id }));
    customerPost.mockResolvedValue({ body: {} });
    const { updateCustomerGarage } = await load();
    const { addVehicle } = await import('@/lib/vehicles/garage');
    const next = await updateCustomerGarage('c1', (g) => addVehicle(g, a3));
    expect(next.vehicles.map((v) => v.id)).toEqual([golf.id, a3.id]);
    const sent = customerPost.mock.calls[0][0] as { body: { version: number; actions: Array<{ action: string; name: string; value: string }> } };
    expect(sent.body.version).toBe(3);
    expect(sent.body.actions).toHaveLength(1);
    expect(sent.body.actions[0]).toMatchObject({ action: 'setCustomField', name: 'garage' });
    expect(JSON.parse(sent.body.actions[0].value)).toEqual({ vehicles: [golf, a3], activeId: a3.id });
  });

  it('sets the custom type first when the customer has none', async () => {
    customerGet.mockResolvedValue(customer(null, 1, false));
    customerPost.mockResolvedValue({ body: {} });
    const { updateCustomerGarage } = await load();
    const { addVehicle } = await import('@/lib/vehicles/garage');
    await updateCustomerGarage('c1', (g) => addVehicle(g, golf));
    const sent = customerPost.mock.calls[0][0] as { body: { actions: Array<{ action: string; type: { key: string; typeId: string }; fields: { garage: string } }> } };
    expect(sent.body.actions[0]).toMatchObject({ action: 'setCustomType', type: { key: 'malva-customer', typeId: 'type' } });
    expect(JSON.parse(sent.body.actions[0].fields.garage).activeId).toBe(golf.id);
  });

  it('retries once with a fresh version on a 409', async () => {
    customerGet.mockResolvedValueOnce(customer({ vehicles: [golf], activeId: golf.id }, 3)).mockResolvedValueOnce(customer({ vehicles: [golf, astra], activeId: golf.id }, 4));
    customerPost.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce({ body: {} });
    const { updateCustomerGarage } = await load();
    const { addVehicle } = await import('@/lib/vehicles/garage');
    const next = await updateCustomerGarage('c1', (g) => addVehicle(g, a3));
    expect(customerPost).toHaveBeenCalledTimes(2);
    expect((customerPost.mock.calls[1][0] as { body: { version: number } }).body.version).toBe(4);
    expect(next.vehicles.map((v) => v.id)).toEqual([golf.id, astra.id, a3.id]);
  });

  it('gives up after repeated conflicts', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf], activeId: golf.id }));
    customerPost.mockRejectedValue({ statusCode: 409 });
    const { updateCustomerGarage } = await load();
    await expect(updateCustomerGarage('c1', (g) => ({ vehicles: [...g.vehicles, a3], activeId: a3.id }))).rejects.toMatchObject({ statusCode: 409 });
    expect(customerPost).toHaveBeenCalledTimes(2);
  });

  it('does not write when nothing changed', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf], activeId: golf.id }));
    const { updateCustomerGarage } = await load();
    await updateCustomerGarage('c1', (g) => g);
    expect(customerPost).not.toHaveBeenCalled();
  });
});

describe('Merge at sign-in: mergeGarageOnSignIn', () => {
  it('reads the account garage, merges, writes it back and returns it', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf, a3], activeId: golf.id }));
    customerPost.mockResolvedValue({ body: {} });
    const { mergeGarageOnSignIn } = await load();
    const merged = await mergeGarageOnSignIn('c1', { vehicles: [astra], activeId: astra.id });
    expect(merged.vehicles.map((v) => v.id)).toEqual([golf.id, a3.id, astra.id]);
    expect(merged.activeId).toBe(astra.id);
    expect(customerPost).toHaveBeenCalledTimes(1);
  });

  it('an empty anonymous garage leaves the account untouched', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf], activeId: golf.id }));
    const { mergeGarageOnSignIn } = await load();
    expect((await mergeGarageOnSignIn('c1', { vehicles: [], activeId: null })).activeId).toBe(golf.id);
    expect(customerPost).not.toHaveBeenCalled();
  });

  it('anonymous entries are re-validated against the table', async () => {
    customerGet.mockResolvedValue(customer({ vehicles: [golf], activeId: golf.id }));
    customerPost.mockResolvedValue({ body: {} });
    const { mergeGarageOnSignIn } = await load();
    const merged = await mergeGarageOnSignIn('c1', { vehicles: [{ ...a3, model: 'A9', engine: '9.9' }], activeId: null });
    expect(merged.vehicles.map((v) => v.id)).toEqual([golf.id]);
  });
});
