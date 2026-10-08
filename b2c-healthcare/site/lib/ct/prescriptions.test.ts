import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { ALEX_REF, ALL_RX, CATALOG, SAM_REF } from '@/test/rx-fixtures-for-tests';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));
vi.mock('@/lib/ct/clinical-store', () => ({
  prescriptionSource: {
    listForPatient: async (ref: string) => ALL_RX.filter((r) => r.patientRef === ref),
    getByNumber: async (n: string) => ALL_RX.find((r) => r.number === n) ?? null,
  },
}));
let supply: Map<string, { sku: string; available: number; expiryDate?: string }>;
vi.mock('@/lib/ct/shelf-life', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/shelf-life')>()), getSupplyBySku: async () => supply }));
vi.mock('@/lib/ct/rx-catalog', () => ({
  getCatalogBySku: async (skus: string[]) => new Map(skus.filter((s) => CATALOG[s]).map((s) => [s, { medication: CATALOG[s], shortDatedPrice: null }])),
}));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { findOwnPrescription, lookupPrescription, RxNotFoundError, validateRxSelection } from '@/lib/ct/prescriptions';

const sam = { patientRef: SAM_REF, name: 'Sam Rivera' };
const ctx = { locale: 'en-US', currency: 'USD', country: 'US', now: new Date('2026-10-08T12:00:00Z') };

beforeEach(() => {
  fake = createFakeObjects();
  supply = new Map(Object.keys(CATALOG).map((sku) => [sku, { sku, available: 600 }]));
});

describe('prescription-bound-supply: validateRxSelection (used by the cart, workstream O)', () => {
  it('accepts the selectable lines with what the cart and the order need, and consumes nothing', async () => {
    const result = await validateRxSelection(sam, 'rx 77102', ['RX-77102-1', 'RX-77102-2'], ctx);
    expect(result.rxNumber).toBe('RX-77102');
    expect(result.refused).toEqual([]);
    expect(result.accepted).toEqual([
      { lineRef: 'RX-77102-1', sku: 'MED-ator', qty: 30, packs: 1, price: { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 }, perOrderMax: 3, periodCeiling: 3 },
      expect.objectContaining({ lineRef: 'RX-77102-2', sku: 'MED-lis' }),
    ]);
    expect(fake.objects).toHaveLength(0);
  });

  it('Request exceeds what remains: a prescription with no refills refuses every line and states 0 available', async () => {
    const result = await validateRxSelection(sam, 'RX-48213', ['RX-48213-1'], ctx);
    expect(result.accepted).toEqual([]);
    expect(result.refused[0]).toMatchObject({ lineRef: 'RX-48213-1', status: 'NO_REFILLS', remaining: 0, selectable: false });
  });

  it('Authorization outside its window: expiry is the reason', async () => {
    const result = await validateRxSelection(sam, 'RX-31877', ['RX-31877-1'], ctx);
    expect(result.refused[0].status).toBe('EXPIRED');
  });

  it('one refused line does not block the others', async () => {
    supply.set('MED-lis', { sku: 'MED-lis', available: 0 });
    const result = await validateRxSelection(sam, 'RX-77102', ['RX-77102-1', 'RX-77102-2'], ctx);
    expect(result.accepted.map((l) => l.lineRef)).toEqual(['RX-77102-1']);
    expect(result.refused.map((l) => [l.lineRef, l.status])).toEqual([['RX-77102-2', 'OUT_OF_STOCK']]);
  });

  it('a line ref that is not on the prescription is refused; duplicates are collapsed', async () => {
    const result = await validateRxSelection(sam, 'RX-77102', ['RX-77102-1', 'RX-77102-1', 'RX-77102-9'], ctx);
    expect(result.accepted).toHaveLength(1);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0].lineRef).toBe('RX-77102-9');
  });

  it('Ceiling lowered while a cart is open: running it again at cart load refuses the line', async () => {
    const before = await validateRxSelection(sam, 'RX-77102', ['RX-77102-1'], ctx);
    expect(before.accepted).toHaveLength(1);
    const original = CATALOG['MED-ator'].maxQtyPerOrder;
    CATALOG['MED-ator'] = { ...CATALOG['MED-ator'], maxQtyPerOrder: 0 };
    try {
      const after = await validateRxSelection(sam, 'RX-77102', ['RX-77102-1'], ctx);
      expect(after.accepted).toEqual([]);
      expect(after.refused[0]).toMatchObject({ status: 'CEILING', ceiling: 0, remaining: 0 });
    } finally {
      CATALOG['MED-ator'] = { ...CATALOG['MED-ator'], maxQtyPerOrder: original };
    }
  });

  it('unknown and foreign numbers are the same error', async () => {
    await expect(validateRxSelection(sam, 'RX-00000', ['x'], ctx)).rejects.toBeInstanceOf(RxNotFoundError);
    await expect(validateRxSelection(sam, 'RX-90001', ['RX-90001-1'], ctx)).rejects.toBeInstanceOf(RxNotFoundError);
    await expect(validateRxSelection(sam, 'nonsense', [], ctx)).rejects.toBeInstanceOf(RxNotFoundError);
  });
});

describe('lookup ownership', () => {
  it('findOwnPrescription returns null for a prescription of another patient', async () => {
    expect(await findOwnPrescription(SAM_REF, 'RX-90001')).toBeNull();
    expect((await findOwnPrescription(ALEX_REF, 'RX-90001'))?.number).toBe('RX-90001');
  });

  it('lookupPrescription answers null for malformed, unknown and foreign input alike', async () => {
    for (const input of ['', 'abc', 'RX-', 'RX-00000', 'RX-90001']) expect(await lookupPrescription(sam, input, ctx)).toBeNull();
    expect((await lookupPrescription(sam, 'rx77102', ctx))?.number).toBe('RX-77102');
    expect(fake.objects.filter((o) => o.container === CONTAINERS.rx)).toHaveLength(0);
  });
});
