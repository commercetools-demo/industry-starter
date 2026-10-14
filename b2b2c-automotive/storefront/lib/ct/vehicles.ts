// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { CustomerUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { mapVehicleRecord } from '@/lib/mappers/vehicle';
import { createTtlCache } from '@/lib/ttl-cache';
import type { Garage, Vehicle, VehicleId, VehicleRecord } from '@/lib/types';
import { expandVehicleToKeys, findFitmentKeyFor, vehicleFromId } from '@/lib/vehicles/catalog';
import { mergeGarages, parseGarage } from '@/lib/vehicles/garage';

/** Custom object container of the vehicle table (seeded by workstream E, read only here). */
export const VEHICLE_CONTAINER = 'mau-vehicles';
/** The seed's customer custom type and its multi-line text field holding the garage JSON. */
export const CUSTOMER_TYPE_KEY = 'malva-customer';
export const GARAGE_FIELD = 'garage';

// The vehicle table is the same for every shopper (about 26 small objects), so one in-memory copy per server instance is safe.
const TABLE_TTL_MS = 3_600_000;
const cache = createTtlCache<VehicleRecord[]>({ ttlMs: TABLE_TTL_MS, negativeTtlMs: 10_000 });
const TABLE_KEY = 'vehicle-table';
let inFlight: Promise<VehicleRecord[]> | null = null;

async function readTable(): Promise<VehicleRecord[]> {
  const { body } = await apiRoot
    .customObjects()
    .get({ queryArgs: { where: `container="${VEHICLE_CONTAINER}"`, limit: 500 } })
    .execute();
  return body.results.map(mapVehicleRecord).filter((r): r is VehicleRecord => r !== null);
}

/**
 * The whole vehicle table in one container read, cached for an hour. A commercetools outage serves the last table;
 * without one the error is rethrown. An empty table is cached only briefly.
 */
export async function listVehicleRecords(): Promise<VehicleRecord[]> {
  const hit = cache.get(TABLE_KEY);
  if (hit) return hit.value ?? [];
  inFlight ??= readTable()
    .then((records) => {
      cache.set(TABLE_KEY, records.length ? records : null);
      return records;
    })
    .catch((error: unknown) => {
      const stale = cache.getStale(TABLE_KEY);
      if (stale?.value) return stale.value;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** The vehicle of an id when the table covers it (slugged make, model and engine, year inside a record's range). */
export async function getVehicleById(id: VehicleId): Promise<Vehicle | null> {
  return vehicleFromId(await listVehicleRecords(), id);
}

/** One table read for all ids; unknown ids are left out, order is kept. */
export async function resolveVehicles(ids: VehicleId[]): Promise<Vehicle[]> {
  const records = await listVehicleRecords();
  return ids.map((id) => vehicleFromId(records, id)).filter((v): v is Vehicle => v !== null);
}

/** The range keys a vehicle fits (see `expandVehicleToKeys`), through the cached table. */
export async function expandKeysFor(vehicle: { make: string; model: string; year: number; engine: string }): Promise<string[]> {
  return expandVehicleToKeys(vehicle, await listVehicleRecords());
}

/** Parses stored garage JSON against the cached table (unknown vehicles dropped, ids canonical, max 5). */
export async function parseGarageJson(input: unknown): Promise<Garage> {
  const records = await listVehicleRecords();
  return parseGarage(input, (entry) => findFitmentKeyFor(records, entry));
}

export async function normalizeGarage(garage: Garage): Promise<Garage> {
  return parseGarageJson(garage);
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

interface CustomerGarageRead {
  garage: Garage;
  version: number;
  /** False when the customer carries no custom type yet (the first write sets `malva-customer`). */
  hasCustomFields: boolean;
}

/** The signed-in customer's garage (`malva-customer.garage`), validated against the vehicle table. */
export async function readCustomerGarage(customerId: string): Promise<CustomerGarageRead> {
  const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
  const raw = body.custom?.fields?.[GARAGE_FIELD];
  return { garage: await parseGarageJson(raw), version: body.version, hasCustomFields: Boolean(body.custom) };
}

/**
 * Read-modify-write of the customer's garage. `update` is applied to the current (normalised) garage; nothing is written when the
 * result is unchanged. A 409 re-reads and re-applies once; a second 409 is thrown. Only `garage` is written: `setCustomField` never
 * touches the other `malva-customer` fields (preferredBranchKey, mobile, consent).
 */
export async function updateCustomerGarage(customerId: string, update: (garage: Garage) => Garage): Promise<Garage> {
  for (let attempt = 0; ; attempt += 1) {
    const current = await readCustomerGarage(customerId);
    const next = await normalizeGarage(update(current.garage));
    if (JSON.stringify(next) === JSON.stringify(current.garage)) return current.garage;
    const value = JSON.stringify(next);
    const action: CustomerUpdateAction = current.hasCustomFields
      ? { action: 'setCustomField', name: GARAGE_FIELD, value }
      : { action: 'setCustomType', type: { typeId: 'type', key: CUSTOMER_TYPE_KEY }, fields: { [GARAGE_FIELD]: value } };
    try {
      await apiRoot
        .customers()
        .withId({ ID: customerId })
        .post({ body: { version: current.version, actions: [action] } })
        .execute();
      return next;
    } catch (error) {
      if (statusOf(error) !== 409 || attempt >= 1) throw error;
    }
  }
}

/**
 * Sign-in hook (registered by workstreams Q and N): merges the anonymous garage into the account garage, writes it back and returns it.
 * The caller clears the anonymous cookie afterwards (`clearAnonymousGarage` in lib/vehicles/cookie.ts).
 * Account vehicles stay first, the anonymous active vehicle becomes active, at most five vehicles remain.
 */
export async function mergeGarageOnSignIn(customerId: string, anonymousGarage: Garage): Promise<Garage> {
  const anonymous = await normalizeGarage(anonymousGarage);
  return updateCustomerGarage(customerId, (account) => mergeGarages(account, anonymous));
}
