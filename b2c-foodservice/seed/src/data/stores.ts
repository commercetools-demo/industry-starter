// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ChannelDraft } from '@commercetools/platform-sdk';
import { K, ls, type Country } from './base';

/**
 * Collection stores (SEED-PLAN section 5) as supply channels with role InventorySupply. Streets are invented, the city
 * names and coordinates are real. Hours differ per store (some close Sundays).
 */
export interface StoreDef {
  key: string;
  city: string;
  area: string;
  country: Country;
  streetNumber: string;
  street: string;
  postalCode: string;
  phone: string;
  lat: number;
  lng: number;
  hours: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>;
  collectionMinutes: number;
}

const WEEK = (weekday: string, sat: string, sun: string) => ({ mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat, sun });

export const STORES: StoreDef[] = [
  { key: 'mcf-store-nyc-soho', city: 'New York', area: 'SoHo', country: 'US', streetNumber: '48', street: 'Example Lane', postalCode: '10012', phone: '+1 212 555 0101', lat: 40.7233, lng: -74.003, hours: WEEK('08:00-19:00', '09:00-19:00', '10:00-17:00'), collectionMinutes: 30 },
  { key: 'mcf-store-brooklyn', city: 'Brooklyn', area: 'Williamsburg', country: 'US', streetNumber: '112', street: 'Sample Avenue', postalCode: '11211', phone: '+1 718 555 0102', lat: 40.7142, lng: -73.9573, hours: WEEK('07:30-18:30', '08:00-18:30', 'closed'), collectionMinutes: 45 },
  { key: 'mcf-store-berlin-mitte', city: 'Berlin', area: 'Mitte', country: 'DE', streetNumber: '17', street: 'Beispielstraße', postalCode: '10115', phone: '+49 30 555 0103', lat: 52.5342, lng: 13.4021, hours: WEEK('08:00-19:00', '09:00-18:00', 'closed'), collectionMinutes: 30 },
  { key: 'mcf-store-munich', city: 'Munich', area: 'Schwabing', country: 'DE', streetNumber: '5', street: 'Musterweg', postalCode: '80801', phone: '+49 89 555 0104', lat: 48.1642, lng: 11.5864, hours: WEEK('08:30-18:30', '09:00-17:00', 'closed'), collectionMinutes: 45 },
  { key: 'mcf-store-london-soho', city: 'London', area: 'Soho', country: 'GB', streetNumber: '23', street: 'Sample Yard', postalCode: 'W1D 3QB', phone: '+44 20 5550 0105', lat: 51.5136, lng: -0.1365, hours: WEEK('07:30-19:30', '08:30-19:00', '10:00-17:00'), collectionMinutes: 20 },
  { key: 'mcf-store-manchester', city: 'Manchester', area: 'Northern Quarter', country: 'GB', streetNumber: '9', street: 'Example Row', postalCode: 'M4 1HN', phone: '+44 161 555 0106', lat: 53.4839, lng: -2.2338, hours: WEEK('08:00-18:00', '09:00-18:00', 'closed'), collectionMinutes: 30 },
];

export const STORE_KEYS: string[] = STORES.map((s) => s.key);

export const channelDrafts = (): ChannelDraft[] =>
  STORES.map((s) => ({
    key: s.key,
    roles: ['InventorySupply'],
    name: ls(`Malva Coffee ${s.area}`, `Malva Coffee ${s.area}`),
    description: ls(`Collection store in ${s.city}, ${s.area}`, `Abholstore in ${s.city}, ${s.area}`),
    address: { country: s.country, city: s.city, streetName: s.street, streetNumber: s.streetNumber, postalCode: s.postalCode, phone: s.phone },
    geoLocation: { type: 'Point', coordinates: [s.lng, s.lat] },
    custom: {
      type: { typeId: 'type', key: K.typeStore },
      fields: {
        addressLine: `${s.streetNumber} ${s.street}`, city: s.city, postalCode: s.postalCode, phone: s.phone,
        hours: JSON.stringify(s.hours), collectionMinutes: s.collectionMinutes,
      },
    },
  })) as ChannelDraft[];
