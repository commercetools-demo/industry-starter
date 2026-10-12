// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Garage pure logic (workstream J). Safe in client code. The garage is the seed's `malva-customer.garage` JSON:
// { vehicles: [{ id, make, model, year, engine, fitmentKey, nickname? }], activeId }, at most 5 vehicles, newest last.
//
// Contract for the sign-in route (workstreams Q/N): call `mergeGarageOnSignIn(customerId, anonymousGarage)` from lib/ct/vehicles.ts
// with `readAnonymousGarage()` (lib/vehicles/cookie.ts), then `clearAnonymousGarage()`.
import type { Garage, GarageState, GarageVehicle, Vehicle, VehicleId } from '@/lib/types';
import { vehicleLabel } from './catalog';
import { buildVehicleId } from './id';

export const GARAGE_MAX = 5;
export const NICKNAME_MAX = 40;

export const emptyGarage = (): Garage => ({ vehicles: [], activeId: null });

export function toVehicle(entry: GarageVehicle): Vehicle {
  return { id: entry.id, make: entry.make, model: entry.model, year: entry.year, engine: entry.engine, label: vehicleLabel(entry) };
}

/** What the API returns: the garage plus its vehicles with labels and the active one. */
export function toGarageState(garage: Garage): GarageState {
  const vehicles = garage.vehicles.map(toVehicle);
  return { garage, vehicles, active: vehicles.find((v) => v.id === garage.activeId) ?? null };
}

/** Cuts to GARAGE_MAX keeping the active vehicle and, of the others, the latest in array order. Array order is preserved. */
function cap(vehicles: GarageVehicle[], activeId: VehicleId | null): GarageVehicle[] {
  if (vehicles.length <= GARAGE_MAX) return vehicles;
  const keep = new Set<VehicleId>();
  if (activeId && vehicles.some((v) => v.id === activeId)) keep.add(activeId);
  for (let i = vehicles.length - 1; i >= 0 && keep.size < GARAGE_MAX; i -= 1) keep.add(vehicles[i].id);
  return vehicles.filter((v) => keep.has(v.id));
}

/** Adds and activates. A vehicle already present is re-activated, not duplicated. The sixth vehicle drops the first non-active one. */
export function addVehicle(garage: Garage, vehicle: GarageVehicle): Garage {
  if (garage.vehicles.some((v) => v.id === vehicle.id)) return { ...garage, activeId: vehicle.id };
  return { vehicles: cap([...garage.vehicles, vehicle], vehicle.id), activeId: vehicle.id };
}

/** Removes; removing the active vehicle activates the newest remaining one. */
export function removeVehicle(garage: Garage, id: VehicleId): Garage {
  if (!garage.vehicles.some((v) => v.id === id)) return garage;
  const vehicles = garage.vehicles.filter((v) => v.id !== id);
  const activeId = garage.activeId === id ? (vehicles[vehicles.length - 1]?.id ?? null) : garage.activeId;
  return { vehicles, activeId };
}

export function setActive(garage: Garage, id: VehicleId): Garage {
  return garage.vehicles.some((v) => v.id === id) ? { ...garage, activeId: id } : garage;
}

/**
 * Sign-in merge: account vehicles first in their order, then the anonymous ones not already present (union by id).
 * `activeId` is the anonymous active vehicle when the anonymous garage had one, else the account's. Over five, the active vehicle
 * and the latest others stay (there is no timestamp, array order is add order).
 */
export function mergeGarages(account: Garage, anonymous: Garage): Garage {
  const union = [...account.vehicles];
  for (const v of anonymous.vehicles) if (!union.some((u) => u.id === v.id)) union.push(v);
  const wanted = anonymous.activeId && union.some((v) => v.id === anonymous.activeId) ? anonymous.activeId : account.activeId;
  const activeId = wanted && union.some((v) => v.id === wanted) ? wanted : (union[union.length - 1]?.id ?? null);
  return { vehicles: cap(union, activeId), activeId };
}

/** Looks a garage entry up in the vehicle table: the entry's `fitmentKey` (kept when still valid) or null when the table does not cover it. */
export type FitmentKeyResolver = (entry: { make: string; model: string; year: number; engine: string; fitmentKey?: string }) => string | null;

const MAX_JSON_LENGTH = 16_000;

/**
 * Parses stored garage JSON (a string or an already parsed value) defensively. Every entry is re-validated against the vehicle table
 * through `resolveKey`; unknown entries are dropped, ids are rewritten to the canonical dotted form (the seed writes hyphen slugs),
 * `fitmentKey` is replaced by the table's, the optional `nickname` is kept (trimmed, 40 characters), duplicates are removed, the list is
 * cut to five and `activeId` is repaired (the newest vehicle when the stored one is gone). Never throws.
 */
export function parseGarage(input: unknown, resolveKey: FitmentKeyResolver): Garage {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (input.length > MAX_JSON_LENGTH) return emptyGarage();
    try {
      value = JSON.parse(input);
    } catch {
      return emptyGarage();
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return emptyGarage();
  const { vehicles: rawVehicles, activeId: rawActive } = value as { vehicles?: unknown; activeId?: unknown };
  if (!Array.isArray(rawVehicles)) return emptyGarage();

  const vehicles: GarageVehicle[] = [];
  let activeId: VehicleId | null = null;
  for (const raw of rawVehicles) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const { make, model, engine, year } = r;
    if (typeof make !== 'string' || typeof model !== 'string' || typeof engine !== 'string' || typeof year !== 'number' || !Number.isInteger(year)) continue;
    const fitmentKey = resolveKey({ make, model, year, engine, fitmentKey: typeof r.fitmentKey === 'string' ? r.fitmentKey : undefined });
    if (!fitmentKey) continue;
    const id = buildVehicleId({ make, model, year, engine });
    if (vehicles.some((v) => v.id === id)) continue;
    const nickname = typeof r.nickname === 'string' ? r.nickname.trim().slice(0, NICKNAME_MAX) : '';
    vehicles.push({ id, make, model, year, engine, fitmentKey, ...(nickname ? { nickname } : {}) });
    if (typeof rawActive === 'string' && (rawActive === r.id || rawActive === id)) activeId = id;
  }
  if (!vehicles.length) return emptyGarage();
  const active = activeId ?? vehicles[vehicles.length - 1].id;
  return { vehicles: cap(vehicles, active), activeId: active };
}
