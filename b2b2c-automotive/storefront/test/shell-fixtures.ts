// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shared fixtures for the shell and picker tests (not shipped: only imported from tests).
import type { Branch, BranchesResponse, BranchView, StoreSettings } from '@/lib/types';

export const settings: StoreSettings = {
  name: 'Küstenwerk Autoteile',
  freeShippingThresholdCent: 9900,
  currency: 'EUR',
  shipDays: { min: 2, max: 3 },
  timezone: 'Europe/Berlin',
  helpUrl: 'https://help.example.test',
  trackUrl: 'https://track.example.test',
};

export const branch = (over: Partial<BranchView> & { key: string }): BranchView => {
  const base: Branch = {
    key: over.key,
    channelId: `ch-${over.key}`,
    name: over.key,
    address: { street: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg' },
    geo: { lat: 53.4609, lng: 9.9847 },
    hours: { mon: ['08:00', '19:00'] },
    timezone: 'Europe/Berlin',
    pickupMode: 'same-day',
  };
  return { ...base, hoursState: { open: true, closesAt: '20:00' }, pickup: 'today', ...over };
};

export const branches: BranchView[] = [
  branch({ key: 'mau-br-north-berlin', name: 'Küstenwerk Berlin-Mitte', address: { street: 'Werkstattstraße 8', postalCode: '10115', city: 'Berlin' }, geo: { lat: 52.5323, lng: 13.3846 }, hoursState: { open: false, opensAt: '08:00', opensToday: false }, pickup: 'tomorrow' }),
  branch({ key: 'mau-br-north-bremen', name: 'Küstenwerk Bremen', address: { street: 'Industriering 5', postalCode: '28197', city: 'Bremen' }, geo: { lat: 53.0698, lng: 8.7615 }, hoursState: { open: true, closesAt: '18:00' }, pickup: 'tomorrow' }),
  branch({ key: 'mau-br-north-hamburg', name: 'Küstenwerk Hamburg-Harburg' }),
];

export const branchesResponse = (over: Partial<BranchesResponse> = {}): BranchesResponse => ({
  single: false,
  selectedKey: 'mau-br-north-hamburg',
  chosen: false,
  branches,
  ...over,
});
