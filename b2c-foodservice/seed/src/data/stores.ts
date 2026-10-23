// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ChannelDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * Collection stores (D-035) as supply channels with role InventorySupply. All six are in New York City (Manhattan,
 * Brooklyn and Queens). Street numbers and phone numbers are invented, the neighbourhoods and coordinates are real.
 * Collection is a US-market feature; Canada is delivery only. Hours differ per store (some close Sundays). Every store
 * has a ready time of 30 minutes.
 */
export interface StoreDef {
  key: string;
  city: string;
  area: string;
  country: 'US';
  state: 'NY';
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
const READY_MINUTES = 30;

export const STORES: StoreDef[] = [
  { key: 'mcf-store-nyc-soho', city: 'New York', area: 'SoHo', country: 'US', state: 'NY', streetNumber: '148', street: 'Prince Street', postalCode: '10012', phone: '+1 212 555 0101', lat: 40.7243, lng: -73.9992, hours: WEEK('08:00-19:00', '09:00-19:00', '10:00-17:00'), collectionMinutes: READY_MINUTES },
  { key: 'mcf-store-brooklyn-williamsburg', city: 'Brooklyn', area: 'Williamsburg', country: 'US', state: 'NY', streetNumber: '212', street: 'Bedford Avenue', postalCode: '11249', phone: '+1 718 555 0102', lat: 40.7172, lng: -73.9573, hours: WEEK('07:30-18:30', '08:00-18:30', 'closed'), collectionMinutes: READY_MINUTES },
  { key: 'mcf-store-upper-west-side', city: 'New York', area: 'Upper West Side', country: 'US', state: 'NY', streetNumber: '2150', street: 'Broadway', postalCode: '10023', phone: '+1 212 555 0103', lat: 40.7819, lng: -73.9805, hours: WEEK('08:00-19:00', '09:00-18:00', '09:00-17:00'), collectionMinutes: READY_MINUTES },
  { key: 'mcf-store-midtown-east', city: 'New York', area: 'Midtown East', country: 'US', state: 'NY', streetNumber: '305', street: 'Lexington Avenue', postalCode: '10016', phone: '+1 212 555 0104', lat: 40.7455, lng: -73.9786, hours: WEEK('07:00-19:30', '09:00-17:00', 'closed'), collectionMinutes: READY_MINUTES },
  { key: 'mcf-store-long-island-city', city: 'Queens', area: 'Long Island City', country: 'US', state: 'NY', streetNumber: '47-18', street: 'Vernon Boulevard', postalCode: '11101', phone: '+1 718 555 0105', lat: 40.7447, lng: -73.9535, hours: WEEK('07:30-18:30', '08:30-18:00', 'closed'), collectionMinutes: READY_MINUTES },
  { key: 'mcf-store-harlem', city: 'New York', area: 'Harlem', country: 'US', state: 'NY', streetNumber: '1860', street: 'Adam Clayton Powell Jr. Boulevard', postalCode: '10026', phone: '+1 212 555 0106', lat: 40.8013, lng: -73.9552, hours: WEEK('08:00-18:00', '09:00-18:00', '10:00-16:00'), collectionMinutes: READY_MINUTES },
];

export const STORE_KEYS: string[] = STORES.map((s) => s.key);

export const channelDrafts = (): ChannelDraft[] =>
  STORES.map((s) => ({
    key: s.key,
    roles: ['InventorySupply'],
    name: ls(`Malva Coffee ${s.area}`),
    description: ls(`Collection store in ${s.area}, ${s.city}`),
    address: { country: s.country, state: s.state, city: s.city, streetName: s.street, streetNumber: s.streetNumber, postalCode: s.postalCode, phone: s.phone },
    geoLocation: { type: 'Point', coordinates: [s.lng, s.lat] },
    custom: {
      type: { typeId: 'type', key: K.typeStore },
      fields: {
        addressLine: `${s.streetNumber} ${s.street}`, city: s.city, postalCode: s.postalCode, phone: s.phone,
        hours: JSON.stringify(s.hours), collectionMinutes: s.collectionMinutes,
      },
    },
  })) as ChannelDraft[];
