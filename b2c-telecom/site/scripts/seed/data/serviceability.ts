// Serviceability table (D-020): seeded as Custom Objects, container `malva-serviceability`, key = postal code.
// A postal code absent from the table is not served at all (use 00000 in tests). K reads these objects (cached 5 minutes).
import type { CustomObjectDraft } from '../types';

export const SERVICEABILITY_CONTAINER = 'malva-serviceability';

export interface ServiceabilityRow {
  postalCode: string;
  country: 'US' | 'DE';
  city: string;
  state: string;
  services: { cable: boolean; 'fixed-wireless': boolean; phone: boolean };
}

const all = { cable: true, 'fixed-wireless': true, phone: true };

export const SERVICEABILITY_ROWS: ServiceabilityRow[] = [
  { postalCode: '10118', country: 'US', city: 'New York', state: 'NY', services: all },
  { postalCode: '30309', country: 'US', city: 'Atlanta', state: 'GA', services: all },
  { postalCode: '94105', country: 'US', city: 'San Francisco', state: 'CA', services: all },
  { postalCode: '27517', country: 'US', city: 'Chapel Hill', state: 'NC', services: all },
  { postalCode: '60601', country: 'US', city: 'Chicago', state: 'IL', services: { cable: true, 'fixed-wireless': false, phone: true } },
  { postalCode: '78701', country: 'US', city: 'Austin', state: 'TX', services: { cable: false, 'fixed-wireless': true, phone: true } },
  { postalCode: '59001', country: 'US', city: 'Absarokee', state: 'MT', services: { cable: false, 'fixed-wireless': false, phone: true } },
  { postalCode: '10115', country: 'DE', city: 'Berlin', state: 'BE', services: all },
  { postalCode: '20095', country: 'DE', city: 'Hamburg', state: 'HH', services: all },
  { postalCode: '80331', country: 'DE', city: 'München', state: 'BY', services: { cable: true, 'fixed-wireless': false, phone: true } },
  { postalCode: '01067', country: 'DE', city: 'Dresden', state: 'SN', services: { cable: false, 'fixed-wireless': true, phone: true } },
];

/** The value stored in the Custom Object (the postal code is the key). */
export function rowValue(row: ServiceabilityRow): { country: string; city: string; state: string; services: ServiceabilityRow['services'] } {
  return { country: row.country, city: row.city, state: row.state, services: row.services };
}

export const serviceability: CustomObjectDraft[] = SERVICEABILITY_ROWS.map((row) => ({
  key: row.postalCode,
  container: SERVICEABILITY_CONTAINER,
  value: rowValue(row),
}));
