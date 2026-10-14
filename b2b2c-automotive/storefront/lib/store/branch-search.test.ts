// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { branches } from '@/test/shell-fixtures';
import { arrangeBranches, matchesQuery, normalise } from './branch-search';

const keys = (rows: ReturnType<typeof arrangeBranches>) => rows.map((r) => r.branch.key);

describe('Choose a store: list order and filter', () => {
  it('without an origin the list is alphabetical by name', () => {
    expect(keys(arrangeBranches(branches, { query: '', origin: null, geocoded: false }))).toEqual(['mau-br-north-berlin', 'mau-br-north-bremen', 'mau-br-north-hamburg']);
  });
  it('sorts by distance', () => {
    const rows = arrangeBranches(branches, { query: '', origin: { lat: 53.55, lng: 9.99 }, geocoded: false }); // Hamburg centre
    expect(keys(rows)).toEqual(['mau-br-north-hamburg', 'mau-br-north-bremen', 'mau-br-north-berlin']);
    expect(rows[0].distanceKm).toBeLessThan(15);
  });
  it('postal prefix filters', () => {
    expect(keys(arrangeBranches(branches, { query: '28', origin: null, geocoded: false }))).toEqual(['mau-br-north-bremen']);
    expect(matchesQuery(branches[2], '079')).toBe(false); // a prefix, not a substring
  });
  it('city filters case-insensitively and ignores accents', () => {
    expect(keys(arrangeBranches(branches, { query: 'BREMEN', origin: null, geocoded: false }))).toEqual(['mau-br-north-bremen']);
    expect(normalise('München')).toBe('munchen');
  });
  it('geocode result sorts by distance from the searched place and keeps every branch', () => {
    const rows = arrangeBranches(branches, { query: 'Lübeck', origin: { lat: 53.87, lng: 10.69 }, geocoded: true });
    expect(keys(rows)).toEqual(['mau-br-north-hamburg', 'mau-br-north-bremen', 'mau-br-north-berlin']);
  });
  it('a branch without coordinates sorts last when an origin is known', () => {
    const noGeo = { ...branches[0], key: 'x', name: 'A first', geo: undefined };
    expect(keys(arrangeBranches([noGeo, ...branches], { query: '', origin: { lat: 53.55, lng: 9.99 }, geocoded: false })).at(-1)).toBe('x');
  });
});
