import { describe, expect, it } from 'vitest';
import { SERVICEABILITY_CONTAINER, SERVICEABILITY_ROWS, serviceability } from './serviceability';
import { exportServiceability, SERVICEABILITY_JSON } from '../export-serviceability';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('serviceability table', () => {
  it('eleven rows in the container malva-serviceability, key = postal code', () => {
    expect(serviceability).toHaveLength(11);
    for (const object of serviceability) expect(object.container).toBe(SERVICEABILITY_CONTAINER);
    expect(serviceability.map((o) => o.key)).toEqual(['10118', '30309', '94105', '27517', '60601', '78701', '59001', '10115', '20095', '80331', '01067']);
  });

  it('services per row: 59001 has phone only, 60601 cable and phone, 78701 wireless and phone', () => {
    const row = (code: string) => SERVICEABILITY_ROWS.find((r) => r.postalCode === code);
    expect(row('59001')?.services).toEqual({ cable: false, 'fixed-wireless': false, phone: true });
    expect(row('60601')?.services).toEqual({ cable: true, 'fixed-wireless': false, phone: true });
    expect(row('78701')?.services).toEqual({ cable: false, 'fixed-wireless': true, phone: true });
    expect(row('10118')?.services).toEqual({ cable: true, 'fixed-wireless': true, phone: true });
    expect(row('10115')?.country).toBe('DE');
  });

  it('a postal code absent from the table is not served at all', () => {
    expect(SERVICEABILITY_ROWS.some((r) => r.postalCode === '00000')).toBe(false);
  });

  it('the JSON export for K equals the data', () => {
    const exported = exportServiceability();
    expect(exported['10118']).toEqual({ country: 'US', city: 'New York', state: 'NY', services: { cable: true, 'fixed-wireless': true, phone: true } });
    expect(Object.keys(exported)).toHaveLength(11);
    const onDisk = JSON.parse(readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'offers', 'serviceability-table.json'), 'utf8'));
    expect(onDisk).toEqual(exported);
    expect(SERVICEABILITY_JSON.endsWith('serviceability-table.json')).toBe(true);
  });
});
