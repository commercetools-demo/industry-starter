import { beforeEach, describe, expect, it, vi } from 'vitest';

const addRxLines = vi.fn();
vi.mock('@/lib/ct/cart', () => ({ addRxLines: (...a: unknown[]) => addRxLines(...a) }));
const validate = vi.fn();
const { RxNotFoundError } = vi.hoisted(() => ({ RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validate(...a) }));
const catalog = vi.fn();
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: (...a: unknown[]) => catalog(...a) }));

import { addListToCart } from './lists-add-all';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const line = (name: string, sku: string, rxNumber: string | null, lineRef = 'L1') => ({
  id: `li-${sku}`,
  name: { 'en-US': name },
  variant: { sku },
  custom: rxNumber ? { fields: { rxNumber, rxLineRef: lineRef } } : undefined,
});
const input = { customerId: 'c1', cartId: undefined as string | undefined, patient: { patientRef: 'pt', name: 'Sam' }, ctx: { locale: 'en-US', currency: 'USD', country: 'US' } };
const accepted = (lineRef: string) => ({ lineRef, sku: `SKU-${lineRef}`, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const refused = (lineRef: string, status: string) => ({ lineRef, name: '', sig: '', qty: 0, price: null, status, selectable: false, minShelfLifeMonths: null });
const inCatalog = (...skus: string[]) => catalog.mockResolvedValue(new Map(skus.map((s) => [s, { medication: { price: usd(1000) }, shortDatedPrice: null }])));

beforeEach(() => {
  addRxLines.mockReset().mockResolvedValue({ cart: { id: 'cart-1' } });
  validate.mockReset();
  catalog.mockReset();
});

describe('saved-lists › List converted in one operation', () => {
  it('adds every dispensable line in one call, names nothing, and does not touch the list', async () => {
    inCatalog('A', 'B');
    validate.mockResolvedValue({ rxNumber: 'RX-1', accepted: [accepted('L1'), accepted('L2')], refused: [] });
    const list = { lineItems: [line('Atorvastatin', 'A', 'RX-1', 'L1'), line('Lisinopril', 'B', 'RX-1', 'L2')] };
    const before = JSON.stringify(list);
    const { result, cartId } = await addListToCart(list as never, input);
    expect(result).toEqual({ added: ['Atorvastatin', 'Lisinopril'], notAdded: [] });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith(input.patient, 'RX-1', ['L1', 'L2'], input.ctx);
    expect(addRxLines).toHaveBeenCalledTimes(1);
    expect(cartId).toBe('cart-1');
    expect(JSON.stringify(list)).toBe(before);
  });
});

describe('saved-lists › Line no longer purchasable', () => {
  it('adds the remaining lines and names the excluded one with its reason', async () => {
    inCatalog('A', 'B', 'C');
    validate.mockResolvedValue({ rxNumber: 'RX-1', accepted: [accepted('L1')], refused: [refused('L2', 'NO_REFILLS'), refused('L3', 'OUT_OF_STOCK')] });
    const list = { lineItems: [line('Atorvastatin', 'A', 'RX-1', 'L1'), line('Lisinopril', 'B', 'RX-1', 'L2'), line('Metformin', 'C', 'RX-1', 'L3')] };
    const { result } = await addListToCart(list as never, input);
    expect(result.added).toEqual(['Atorvastatin']);
    expect(result.notAdded).toEqual([
      { name: 'Lisinopril', reason: 'NO_REFILLS' },
      { name: 'Metformin', reason: 'OUT_OF_STOCK' },
    ]);
  });

  it('a product that left the catalog, one without a price here and one with no prescription reference are named as unavailable', async () => {
    catalog.mockResolvedValue(new Map([['B', { medication: { price: null }, shortDatedPrice: null }]]));
    const list = { lineItems: [line('Gone', 'A', 'RX-1'), line('No price', 'B', 'RX-1', 'L2'), line('No rx', 'C', null)] };
    const { result } = await addListToCart(list as never, input);
    expect(result.notAdded).toEqual([
      { name: 'Gone', reason: 'UNAVAILABLE' },
      { name: 'No price', reason: 'UNAVAILABLE' },
      { name: 'No rx', reason: 'UNAVAILABLE' },
    ]);
    expect(validate).not.toHaveBeenCalled();
    expect(addRxLines).not.toHaveBeenCalled();
  });

  it('every line blocked: nothing is added and all are named; a vanished prescription is unavailable', async () => {
    inCatalog('A', 'B');
    validate.mockImplementation(async (_p: unknown, rx: string) => {
      if (rx === 'RX-9') throw new RxNotFoundError();
      return { rxNumber: rx, accepted: [], refused: [refused('L1', 'EXPIRED')] };
    });
    const list = { lineItems: [line('Atorvastatin', 'A', 'RX-1'), line('Lisinopril', 'B', 'RX-9')] };
    const { result } = await addListToCart(list as never, input);
    expect(addRxLines).not.toHaveBeenCalled();
    expect(result).toEqual({ added: [], notAdded: [{ name: 'Atorvastatin', reason: 'EXPIRED' }, { name: 'Lisinopril', reason: 'UNAVAILABLE' }] });
  });

  it('an empty list adds nothing and calls nothing', async () => {
    const { result, cartId } = await addListToCart({ lineItems: [] } as never, input);
    expect(result).toEqual({ added: [], notAdded: [] });
    expect(addRxLines).not.toHaveBeenCalled();
    expect(cartId).toBeUndefined();
  });
});
