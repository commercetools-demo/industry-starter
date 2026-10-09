import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Prescription } from '@/lib/clinical/types';
import {
  AUTHORIZATION_PARAMS_FIELDS,
  buildLineRecord,
  fromLineCustomFields,
  ORDER_LINE_RECORD_FIELDS,
  SUPPLIED_LOT_FIELDS,
  toLineCustomFields,
  withSuppliedLots,
  type AuthorizationParams,
  type OrderLineRecord,
  type SuppliedLot,
} from './line-record';

const rx: Prescription = {
  number: 'RX-77102',
  patientRef: 'pt_sam',
  prescriber: 'Dr. Sofia Marchetti',
  issuedAt: '2026-09-24',
  expiresAt: '2027-09-24',
  refillsLeft: 3,
  lines: [{ lineRef: 'RX-77102-1', sku: 'MED-ator', name: 'Atorvastatin 20 mg tablets', sig: '1 tablet nightly', qty: 30 }],
};

// Compile-time pin: the record types have exactly these keys. A new key fails the type check here.
const _record: Record<(typeof ORDER_LINE_RECORD_FIELDS)[number], unknown> = {} as Record<keyof OrderLineRecord, unknown>;
const _params: Record<(typeof AUTHORIZATION_PARAMS_FIELDS)[number], unknown> = {} as Record<keyof AuthorizationParams, unknown>;
const _lot: Record<(typeof SUPPLIED_LOT_FIELDS)[number], unknown> = {} as Record<keyof SuppliedLot, unknown>;
void [_record, _params, _lot];

describe('prescription-bound-supply: Parameters readable from the order', () => {
  it('copies the authorization parameters onto the line, so later amendment or withdrawal does not change the order', () => {
    const record = buildLineRecord(rx, rx.lines[0]);
    expect(record).toEqual({
      rxNumber: 'RX-77102',
      rxLineRef: 'RX-77102-1',
      prescribedQty: 30,
      dispensedQty: 30,
      authorizationParams: { issuedAt: '2026-09-24', expiresAt: '2027-09-24', refillsBefore: 3 },
      suppliedLots: [],
    });
    // the prescription is amended afterwards
    rx.lines[0].qty = 90;
    const amended = structuredClone(rx);
    amended.refillsLeft = 0;
    expect(record.prescribedQty).toBe(30);
    expect(record.authorizationParams.refillsBefore).toBe(3);
    rx.lines[0].qty = 30;
  });

  it('survives the round trip through flat custom fields', () => {
    const record = withSuppliedLots(buildLineRecord(rx, rx.lines[0]), [{ lot: 'L-1', expiryDate: '2027-03-01', qty: 30 }]);
    const fields = toLineCustomFields(record);
    expect(Object.values(fields).every((v) => typeof v === 'string' || typeof v === 'number')).toBe(true);
    expect(fromLineCustomFields(fields)).toEqual(record);
  });

  it('a line without the fields is not a prescription line', () => {
    expect(fromLineCustomFields(undefined)).toBeNull();
    expect(fromLineCustomFields({ other: 1 })).toBeNull();
  });

  it('a corrupt JSON field falls back instead of throwing', () => {
    expect(fromLineCustomFields({ rxNumber: 'RX-1', suppliedLots: '{oops', authorizationParams: 'x' })?.suppliedLots).toEqual([]);
  });
});

describe('prescription-bound-supply: nothing clinical beyond the authorization is copied', () => {
  it('the record has no sig, diagnosis, condition or medication-name field, at runtime and in the type', () => {
    const record = withSuppliedLots(buildLineRecord(rx, rx.lines[0]), [{ lot: 'L', qty: 30 }]);
    const keys = JSON.stringify([record, toLineCustomFields(record)]);
    expect(keys).not.toMatch(/sig|diagnos|condition|reason|Atorvastatin|nightly|Marchetti/i);
    expect(Object.keys(record).sort()).toEqual([...ORDER_LINE_RECORD_FIELDS].sort());
    expect(Object.keys(record.authorizationParams).sort()).toEqual([...AUTHORIZATION_PARAMS_FIELDS].sort());
  });

  it('the type declarations themselves never mention sig, diagnosis or condition as a field', () => {
    const source = readFileSync(resolve(__dirname, 'line-record.ts'), 'utf8');
    const declarations = source.match(/export interface [\s\S]*?\n}\n/g)?.join('\n') ?? '';
    expect(declarations).toContain('interface OrderLineRecord');
    expect(declarations.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/\b(sig|diagnosis|diagnoses|condition|nameOfCondition|medicationName)\b/i);
  });
});

describe('expiry-dated-supply: Supplied lot recorded / Mixed lots on one line / Undated goods unaffected', () => {
  const base = buildLineRecord(rx, rx.lines[0]);

  it('Supplied lot recorded: the lot and expiry that were actually supplied are on the line', () => {
    const record = withSuppliedLots(base, [{ lot: 'L-2026-114', expiryDate: '2027-03-01', qty: 30 }]);
    expect(record.suppliedLots).toEqual([{ lot: 'L-2026-114', expiryDate: '2027-03-01', qty: 30 }]);
  });

  it('Mixed lots on one line: each lot and its expiry are recorded, not one date for all', () => {
    const record = withSuppliedLots(base, [
      { lot: 'L-A', expiryDate: '2027-01-31', qty: 10 },
      { lot: 'L-B', expiryDate: '2027-06-30', qty: 20 },
    ]);
    expect(record.suppliedLots).toHaveLength(2);
    expect(record.suppliedLots.map((l) => l.expiryDate)).toEqual(['2027-01-31', '2027-06-30']);
    expect(fromLineCustomFields(toLineCustomFields(record))?.suppliedLots).toEqual(record.suppliedLots);
  });

  it('lots that do not add up to the dispensed quantity are rejected', () => {
    expect(() => withSuppliedLots(base, [{ lot: 'L-A', qty: 5 }])).toThrow(/add up/);
  });

  it('Undated goods unaffected: a lot without an expiry records no date', () => {
    const record = withSuppliedLots(base, [{ lot: 'L-X', qty: 30 }]);
    expect(record.suppliedLots[0]).toEqual({ lot: 'L-X', qty: 30 });
    expect('expiryDate' in record.suppliedLots[0]).toBe(false);
  });

  it('nothing is recorded before the warehouse picks: the promise is never written as a lot', () => {
    expect(base.suppliedLots).toEqual([]);
  });
});
