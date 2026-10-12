// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { branchInput, branchKeyFor, createBranchInput, isAllowedAssetUrl, isIanaTimezone, openingHoursSchema, slugOf, stockInput, storeSettingsInput } from './schemas';

const name = { 'de-DE': 'Hamburg Ost', 'en-US': 'Hamburg East' };
const branch = {
  storeKey: 'mau-reseller-north',
  name,
  address: { streetName: 'Hafenallee', streetNumber: '12', postalCode: '21079', city: 'Hamburg', country: 'DE' },
  geoLocation: { lat: 53.46, lng: 9.98 },
  openingHours: { mon: ['08:00', '18:00'], tue: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
  phone: '+49 40 0000000',
};

describe('store settings input', () => {
  const base = { storeKey: 'mau-reseller-north', name, location: { addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', countryCode: 'DE', latitude: 53.46, longitude: 9.98 } };
  it('accepts valid input', () => expect(storeSettingsInput.safeParse(base).success).toBe(true));
  it('latitude without longitude is rejected, and the reverse', () => {
    expect(storeSettingsInput.safeParse({ ...base, location: { latitude: 10 } }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, location: { longitude: 10 } }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, location: {} }).success).toBe(true);
  });
  it('range and name length', () => {
    expect(storeSettingsInput.safeParse({ ...base, location: { latitude: 91, longitude: 0 } }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, location: { latitude: 0, longitude: 181 } }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, name: { ...name, 'en-US': 'A' } }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, name: { ...name, 'en-US': 'x'.repeat(81) } }).success).toBe(false);
  });
  it('no field outside the contract (an address URL, a key, a role)', () => {
    expect(storeSettingsInput.safeParse({ ...base, address: 'https://evil.test' }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...base, location: { ...base.location, key: 'x' } }).success).toBe(false);
  });
});

describe('asset urls', () => {
  it('https or the Contentools origin, clean', () => {
    expect(isAllowedAssetUrl('https://files.example.test/a.png', 'http://localhost:4011')).toBe(true);
    expect(isAllowedAssetUrl('http://localhost:4011/__files/a.png', 'http://localhost:4011')).toBe(true);
    expect(isAllowedAssetUrl('http://evil.test/a.png', 'http://localhost:4011')).toBe(false);
    expect(isAllowedAssetUrl('https://files.example.test/a.png?sig=1', '')).toBe(false);
    expect(isAllowedAssetUrl('javascript:alert(1)', '')).toBe(false);
    expect(isAllowedAssetUrl('https://user:pw@files.example.test/a.png', '')).toBe(false);
  });
});

describe('branch input', () => {
  it('accepts a valid branch', () => expect(branchInput.safeParse(branch).success).toBe(true));
  it('openingHours: weekday keys only, HH:MM, close after open', () => {
    expect(openingHoursSchema.safeParse({ mon: ['08:00', '18:00'] }).success).toBe(true);
    expect(openingHoursSchema.safeParse({}).success).toBe(true);
    expect(openingHoursSchema.safeParse({ mon: ['18:00', '08:00'] }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ mon: ['08:00', '08:00'] }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ mon: ['8:00', '18:00'] }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ monday: ['08:00', '18:00'] }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ mon: ['08:00', '24:00'] }).success).toBe(false);
  });
  it('timezone must be IANA', () => {
    expect(isIanaTimezone('Europe/Berlin')).toBe(true);
    expect(isIanaTimezone('America/Chicago')).toBe(true);
    expect(isIanaTimezone('Mars/Base')).toBe(false);
    expect(isIanaTimezone('../etc')).toBe(false);
    expect(branchInput.safeParse({ ...branch, timezone: 'Nowhere/City' }).success).toBe(false);
  });
  it('pickupMode is one of three', () => {
    for (const mode of ['same-day', 'next-day', 'ship-to-store']) expect(branchInput.safeParse({ ...branch, pickupMode: mode }).success).toBe(true);
    expect(branchInput.safeParse({ ...branch, pickupMode: 'whenever' }).success).toBe(false);
  });
  it('phone at most 30 characters; coordinates in range', () => {
    expect(branchInput.safeParse({ ...branch, phone: 'x'.repeat(31) }).success).toBe(false);
    expect(branchInput.safeParse({ ...branch, geoLocation: { lat: 100, lng: 0 } }).success).toBe(false);
  });
  it('a create needs a slug, an update does not carry one', () => {
    expect(createBranchInput.safeParse(branch).success).toBe(false);
    expect(createBranchInput.safeParse({ ...branch, slug: 'hamburg-east' }).success).toBe(true);
    expect(createBranchInput.safeParse({ ...branch, slug: '../x' }).success).toBe(false);
    expect(branchInput.safeParse({ ...branch, slug: 'x' }).success).toBe(false);
  });
});

describe('branch keys', () => {
  it('follow mau-br-<store suffix>-<slug>', () => {
    expect(branchKeyFor('mau-reseller-north', 'wandsbek')).toBe('mau-br-north-wandsbek');
    expect(branchKeyFor('mau-reseller-south', 'munich-east')).toBe('mau-br-south-munich-east');
  });
  it('slugOf', () => {
    expect(slugOf('Küstenwerk Hamburg-Harburg')).toBe('kustenwerk-hamburg-harburg');
    expect(slugOf('  !!  ')).toBe('branch');
  });
});

describe('stock input', () => {
  const base = { storeKey: 'store-a' };
  it('quantity 0 to 100000 integer', () => {
    expect(stockInput.safeParse({ ...base, availableQuantity: 0 }).success).toBe(true);
    expect(stockInput.safeParse({ ...base, availableQuantity: 100000 }).success).toBe(true);
    expect(stockInput.safeParse({ ...base, availableQuantity: 100001 }).success).toBe(false);
    expect(stockInput.safeParse({ ...base, availableQuantity: -1 }).success).toBe(false);
    expect(stockInput.safeParse({ ...base, availableQuantity: 1.5 }).success).toBe(false);
  });
  it('price above zero, null clears it, no floor exists', () => {
    expect(stockInput.safeParse({ ...base, priceCent: 1 }).success).toBe(true);
    expect(stockInput.safeParse({ ...base, priceCent: null }).success).toBe(true);
    expect(stockInput.safeParse({ ...base, priceCent: 0 }).success).toBe(false);
    expect(stockInput.safeParse({ ...base, priceCent: -5 }).success).toBe(false);
    expect(stockInput.safeParse({ ...base, priceCent: 12.5 }).success).toBe(false);
  });
  it('needs something to change and refuses unknown fields', () => {
    expect(stockInput.safeParse(base).success).toBe(false);
    expect(stockInput.safeParse({ ...base, availableQuantity: 1, sku: 'X' }).success).toBe(false);
  });
});
