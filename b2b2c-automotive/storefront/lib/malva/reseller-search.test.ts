// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Reseller } from '@/lib/malva-types';
import { arrangeResellers, matchesReseller, resellerPath } from './reseller-search';

const reseller = (key: string, name: string, city: string, postalCode: string, lat?: number, lng?: number, branchCities: string[] = []): Reseller => ({
  key,
  name,
  city,
  postalCode,
  address: 'Hafenstraße 1',
  lat,
  lng,
  branches: branchCities.map((c, i) => ({ key: `${key}-b${i}`, name: c, city: c })),
});
const north = reseller('mau-reseller-north', 'Küstenwerk', 'Hamburg', '21079', 53.46, 9.98, ['Bremen', 'Hamburg']);
const south = reseller('mau-reseller-south', 'Südkamm', 'München', '80331', 48.14, 11.58, ['Augsburg']);

describe('resellerPath', () => {
  it('builds the reseller home and the product address', () => {
    expect(resellerPath('mau-reseller-north')).toBe('/mau-reseller-north');
    expect(resellerPath('mau-reseller-north', 'brake-pad-1')).toBe('/mau-reseller-north/p/brake-pad-1');
  });
  it('refuses a key or slug that is not valid', () => {
    expect(resellerPath('../evil')).toBeNull();
    expect(resellerPath('a')).toBeNull();
    expect(resellerPath('mau-reseller-north', 'x/../../y')).toBeNull();
    expect(resellerPath('mau-reseller-north', 'javascript:alert(1)')).toBeNull();
    expect(resellerPath('mau-reseller-north', '')).toBeNull();
  });
});

describe('matchesReseller', () => {
  it('matches a postal code prefix, a city and a branch city, ignoring case and accents', () => {
    expect(matchesReseller(north, '210')).toBe(true);
    expect(matchesReseller(north, '079')).toBe(false);
    expect(matchesReseller(south, 'munchen')).toBe(true);
    expect(matchesReseller(south, 'MÜNCHEN')).toBe(true);
    expect(matchesReseller(north, 'bremen')).toBe(true);
    expect(matchesReseller(south, 'bremen')).toBe(false);
  });
  it('matches everything for an empty query', () => expect(matchesReseller(north, '  ')).toBe(true));
});

describe('arrangeResellers', () => {
  const names = (rows: { reseller: Reseller }[]) => rows.map((r) => r.reseller.name);
  it('orders by name without an origin', () => {
    expect(names(arrangeResellers([south, north], { query: '', origin: null, geocoded: false }))).toEqual(['Küstenwerk', 'Südkamm']);
  });
  it('orders by distance with an origin and reports it', () => {
    const rows = arrangeResellers([north, south], { query: '', origin: { lat: 48.0, lng: 11.5 }, geocoded: false });
    expect(names(rows)).toEqual(['Südkamm', 'Küstenwerk']);
    expect(rows[0].distanceKm).toBeLessThan(rows[1].distanceKm!);
  });
  it('puts a reseller without coordinates last', () => {
    const none = reseller('mau-reseller-none', 'Aaa', 'Ulm', '89073');
    expect(names(arrangeResellers([none, north], { query: '', origin: { lat: 53, lng: 10 }, geocoded: false }))).toEqual(['Küstenwerk', 'Aaa']);
  });
  it('filters by the query; nothing matches without a located place', () => {
    expect(names(arrangeResellers([north, south], { query: 'hamburg', origin: null, geocoded: false }))).toEqual(['Küstenwerk']);
    expect(arrangeResellers([north, south], { query: '99999', origin: null, geocoded: false })).toEqual([]);
  });
  it('keeps everyone, nearest first, when nothing matches but the place was located', () => {
    expect(names(arrangeResellers([north, south], { query: '99999', origin: { lat: 48.1, lng: 11.6 }, geocoded: true }))).toEqual(['Südkamm', 'Küstenwerk']);
  });
});
