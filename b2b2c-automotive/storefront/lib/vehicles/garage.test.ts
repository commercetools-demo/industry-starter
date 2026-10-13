// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Garage, GarageVehicle } from '@/lib/types';
import { findFitmentKeyFor } from './catalog';
import { addVehicle, emptyGarage, GARAGE_MAX, mergeGarages, parseGarage, removeVehicle, renameVehicle, setActive } from './garage';
import { buildVehicleId } from './id';
import { VEHICLE_RECORDS } from './test-fixtures';

const entry = (make: string, model: string, year: number, engine: string, nickname?: string): GarageVehicle => ({
  id: buildVehicleId({ make, model, year, engine }),
  make,
  model,
  year,
  engine,
  fitmentKey: findFitmentKeyFor(VEHICLE_RECORDS, { make, model, year, engine }) ?? 'x',
  ...(nickname ? { nickname } : {}),
});
const golf = entry('Volkswagen', 'Golf', 2016, '2.0 TDI');
const a3 = entry('Audi', 'A3', 2018, '1.4 TFSI');
const astra = entry('Opel', 'Astra', 2019, '1.4 Turbo');
const bmw = entry('BMW', '3 Series', 2017, '320d');
const clio = entry('Renault', 'Clio', 2021, '1.0 TCe');
const focus = entry('Ford', 'Focus', 2020, '1.0 EcoBoost');
const garageOf = (vehicles: GarageVehicle[], activeId: string | null = vehicles[0]?.id ?? null): Garage => ({ vehicles, activeId });
const resolve = (e: { make: string; model: string; year: number; engine: string; fitmentKey?: string }) => findFitmentKeyFor(VEHICLE_RECORDS, e);

describe('Garage: rename (workstream Q-08)', () => {
  it('sets, trims and caps the nickname and keeps the rest', () => {
    const g = garageOf([golf, a3], golf.id);
    const named = renameVehicle(g, golf.id, `  ${'x'.repeat(50)}  `);
    expect(named.vehicles[0].nickname).toHaveLength(40);
    expect(named.vehicles[1]).toEqual(a3);
    expect(named.activeId).toBe(golf.id);
  });
  it('an empty name removes the nickname; an unknown id changes nothing', () => {
    const g = garageOf([entry('Volkswagen', 'Golf', 2016, '2.0 TDI', 'Daily')]);
    expect('nickname' in renameVehicle(g, g.vehicles[0].id, '  ').vehicles[0]).toBe(false);
    expect(renameVehicle(g, 'nope', 'X')).toBe(g);
  });
});

describe('Garage: pure operations', () => {
  it('addVehicle makes it active', () => {
    const g = addVehicle(emptyGarage(), golf);
    expect(g).toEqual({ vehicles: [golf], activeId: golf.id });
    expect(addVehicle(g, a3).activeId).toBe(a3.id);
  });

  it('adding a duplicate re-activates it and does not duplicate', () => {
    const g = addVehicle(addVehicle(emptyGarage(), golf), a3);
    const again = addVehicle(g, { ...golf, nickname: 'ignored' });
    expect(again.vehicles).toHaveLength(2);
    expect(again.activeId).toBe(golf.id);
  });

  it('a sixth vehicle drops the first non-active in array order', () => {
    let g = emptyGarage();
    for (const v of [golf, a3, astra, bmw, clio]) g = addVehicle(g, v);
    expect(g.vehicles).toHaveLength(GARAGE_MAX);
    g = addVehicle(g, focus);
    expect(g.vehicles.map((v) => v.id)).toEqual([a3.id, astra.id, bmw.id, clio.id, focus.id]);
    expect(g.activeId).toBe(focus.id);
  });

  it('delete of the active vehicle activates the newest remaining', () => {
    const g = garageOf([golf, a3, astra], astra.id);
    expect(removeVehicle(g, astra.id)).toEqual({ vehicles: [golf, a3], activeId: a3.id });
    expect(removeVehicle(garageOf([golf], golf.id), golf.id)).toEqual(emptyGarage());
    expect(removeVehicle(g, golf.id).activeId).toBe(astra.id);
    expect(removeVehicle(g, 'nope')).toEqual(g);
  });

  it('setActive switches and ignores unknown ids', () => {
    const g = garageOf([golf, a3], golf.id);
    expect(setActive(g, a3.id).activeId).toBe(a3.id);
    expect(setActive(g, 'nope')).toEqual(g);
  });
});

describe('Garage: merge at sign-in', () => {
  it('merge gives three vehicles without duplicates', () => {
    const merged = mergeGarages(garageOf([golf, a3], golf.id), garageOf([astra], astra.id));
    expect(merged.vehicles.map((v) => v.id)).toEqual([golf.id, a3.id, astra.id]);
  });

  it('merge drops a vehicle present on both sides', () => {
    const merged = mergeGarages(garageOf([golf, a3], golf.id), garageOf([a3, astra], a3.id));
    expect(merged.vehicles.map((v) => v.id)).toEqual([golf.id, a3.id, astra.id]);
  });

  it('previously active vehicle stays active', () => {
    const merged = mergeGarages(garageOf([golf, a3], golf.id), garageOf([astra], astra.id));
    expect(merged.activeId).toBe(astra.id);
  });

  it('account active used when anonymous had none', () => {
    const merged = mergeGarages(garageOf([golf, a3], a3.id), emptyGarage());
    expect(merged).toEqual({ vehicles: [golf, a3], activeId: a3.id });
    expect(mergeGarages(garageOf([golf, a3], a3.id), garageOf([astra], null)).activeId).toBe(a3.id);
  });

  it('cap of five keeps the active', () => {
    const account = garageOf([golf, a3, astra, bmw], golf.id);
    const merged = mergeGarages(account, garageOf([clio, focus], golf.id));
    expect(merged.vehicles).toHaveLength(GARAGE_MAX);
    expect(merged.activeId).toBe(golf.id);
    expect(merged.vehicles.map((v) => v.id)).toEqual([golf.id, astra.id, bmw.id, clio.id, focus.id]);
  });

  it('merging with nothing on either side', () => {
    expect(mergeGarages(emptyGarage(), emptyGarage())).toEqual(emptyGarage());
    expect(mergeGarages(emptyGarage(), garageOf([golf]))).toEqual(garageOf([golf]));
  });
});

describe('Garage: parse', () => {
  it('bad json yields an empty garage', () => {
    expect(parseGarage('{nope', resolve)).toEqual(emptyGarage());
    expect(parseGarage(undefined, resolve)).toEqual(emptyGarage());
    expect(parseGarage('[]', resolve)).toEqual(emptyGarage());
    expect(parseGarage('{"vehicles":"x"}', resolve)).toEqual(emptyGarage());
  });

  it('unknown id dropped', () => {
    const json = JSON.stringify({ vehicles: [golf, { ...a3, model: 'A9', engine: '9.9' }], activeId: golf.id });
    const parsed = parseGarage(json, resolve);
    expect(parsed.vehicles.map((v) => v.id)).toEqual([golf.id]);
  });

  it('drops a vehicle whose year is outside every range', () => {
    const json = JSON.stringify({ vehicles: [{ ...golf, year: 2030 }], activeId: golf.id });
    expect(parseGarage(json, resolve)).toEqual(emptyGarage());
  });

  it('reads the seed shape and rewrites ids to the dotted form, keeping the active vehicle', () => {
    const seed = {
      vehicles: [
        { id: 'volkswagen-golf-2016-2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI' },
        { id: 'audi-a3-2018-1-4-tfsi', make: 'Audi', model: 'A3', year: 2018, engine: '1.4 TFSI', fitmentKey: 'Audi|A3|2012|2020|1.4 TFSI' },
      ],
      activeId: 'audi-a3-2018-1-4-tfsi',
    };
    const parsed = parseGarage(JSON.stringify(seed), resolve);
    expect(parsed.vehicles.map((v) => v.id)).toEqual(['volkswagen.golf.2016.2-0-tdi', 'audi.a3.2018.1-4-tfsi']);
    expect(parsed.activeId).toBe('audi.a3.2018.1-4-tfsi');
  });

  it('keeps the optional nickname (trimmed, max 40 characters) and replaces a wrong fitment key', () => {
    const json = JSON.stringify({
      vehicles: [{ ...golf, fitmentKey: 'Audi|A3|2012|2020|2.0 TDI', nickname: `  ${'x'.repeat(60)}  ` }],
      activeId: golf.id,
    });
    const [v] = parseGarage(json, resolve).vehicles;
    expect(v.nickname).toHaveLength(40);
    expect(v.fitmentKey).toBe('Volkswagen|Golf|2012|2019|2.0 TDI');
  });

  it('removes duplicates, cuts to five keeping the active, and repairs a missing or unknown activeId', () => {
    const six = [golf, a3, astra, bmw, clio, focus];
    const parsed = parseGarage(JSON.stringify({ vehicles: [...six, golf], activeId: golf.id }), resolve);
    expect(parsed.vehicles).toHaveLength(GARAGE_MAX);
    expect(parsed.vehicles.map((v) => v.id)).toContain(golf.id);
    const repaired = parseGarage(JSON.stringify({ vehicles: [golf, a3], activeId: 'gone' }), resolve);
    expect(repaired.activeId).toBe(a3.id);
  });

  it('accepts an already parsed object', () => {
    expect(parseGarage({ vehicles: [golf], activeId: golf.id }, resolve).activeId).toBe(golf.id);
  });
});
