import { beforeEach, describe, expect, it, vi } from 'vitest';

const addRxLines = vi.fn();
vi.mock('@/lib/ct/cart', () => ({ addRxLines: (...a: unknown[]) => addRxLines(...a) }));
const validate = vi.fn();
const { RxNotFoundError } = vi.hoisted(() => ({ RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validate(...a) }));

import { reorderOrder } from './orders-reorder';

const line = (name: string, rxNumber: string | null, lineRef = 'L1') => ({
  name: { 'en-US': name },
  custom: rxNumber ? { fields: { rxNumber, rxLineRef: lineRef, prescribedQty: 30 } } : undefined,
});
const input = { customerId: 'c1', cartId: undefined as string | undefined, patient: { patientRef: 'pt', name: 'Sam' }, ctx: { locale: 'en-US', currency: 'USD', country: 'US' }, locale: 'en-US' };
const accepted = (lineRef: string) => ({ lineRef, sku: `SKU-${lineRef}`, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const refused = (lineRef: string, status: string) => ({ lineRef, name: '', sig: '', qty: 0, price: null, status, selectable: false, minShelfLifeMonths: null });

beforeEach(() => {
  addRxLines.mockReset().mockResolvedValue({ cart: { id: 'cart-1' } });
  validate.mockReset();
});

describe('order-history: Reorder with an unavailable item', () => {
  it('adds the dispensable lines and names every other line with its reason (nothing dropped silently)', async () => {
    validate.mockResolvedValue({ rxNumber: 'RX-1', accepted: [accepted('L1')], refused: [refused('L2', 'NO_REFILLS'), refused('L3', 'EXPIRED'), refused('L4', 'OUT_OF_STOCK'), refused('L5', 'CEILING')] });
    const order = { lineItems: [line('Atorvastatin', 'RX-1', 'L1'), line('Metformin', 'RX-1', 'L2'), line('Lisinopril', 'RX-1', 'L3'), line('Amlodipine', 'RX-1', 'L4'), line('Omeprazole', 'RX-1', 'L5')] };
    const { result, cartId } = await reorderOrder(order as never, input);
    expect(validate).toHaveBeenCalledWith(input.patient, 'RX-1', ['L1', 'L2', 'L3', 'L4', 'L5'], input.ctx);
    expect(addRxLines).toHaveBeenCalledWith('c1', undefined, 'RX-1', [accepted('L1')], input.ctx);
    expect(result.added).toEqual(['Atorvastatin']);
    expect(result.notAdded).toEqual([
      { name: 'Metformin', reason: 'NO_REFILLS' },
      { name: 'Lisinopril', reason: 'EXPIRED' },
      { name: 'Amlodipine', reason: 'OUT_OF_STOCK' },
      { name: 'Omeprazole', reason: 'UNAVAILABLE' },
    ]);
    expect(cartId).toBe('cart-1');
  });

  it('every line is blocked: nothing is added to the cart, all are named', async () => {
    validate.mockResolvedValue({ rxNumber: 'RX-1', accepted: [], refused: [refused('L1', 'NO_REFILLS')] });
    const { result, cartId } = await reorderOrder({ lineItems: [line('Atorvastatin', 'RX-1')] } as never, input);
    expect(addRxLines).not.toHaveBeenCalled();
    expect(result).toEqual({ added: [], notAdded: [{ name: 'Atorvastatin', reason: 'NO_REFILLS' }] });
    expect(cartId).toBeUndefined();
  });

  it('a prescription that no longer exists and a line with no prescription record are reported as unavailable', async () => {
    validate.mockRejectedValue(new RxNotFoundError());
    const { result } = await reorderOrder({ lineItems: [line('Atorvastatin', 'RX-9'), line('Old line', null)] } as never, input);
    expect(result.added).toEqual([]);
    expect(result.notAdded).toEqual([
      { name: 'Old line', reason: 'UNAVAILABLE' },
      { name: 'Atorvastatin', reason: 'UNAVAILABLE' },
    ]);
  });

  it('two prescriptions: each group is validated and added, the second adds to the cart the first created', async () => {
    validate.mockImplementation(async (_p: unknown, rx: string) => ({ rxNumber: rx, accepted: [accepted('L1')], refused: [] }));
    addRxLines.mockResolvedValueOnce({ cart: { id: 'cart-new' } }).mockResolvedValueOnce({ cart: { id: 'cart-new' } });
    const { result } = await reorderOrder({ lineItems: [line('A', 'RX-1'), line('B', 'RX-2')] } as never, input);
    expect(result.added).toEqual(['A', 'B']);
    expect(addRxLines.mock.calls[1]?.[1]).toBe('cart-new');
  });

  it("the platform's own quantity limit refuses a group: its lines are named, the reorder still answers", async () => {
    validate.mockResolvedValue({ rxNumber: 'RX-1', accepted: [accepted('L1')], refused: [] });
    addRxLines.mockRejectedValue({ body: { errors: [{ code: 'LineItemQuantityAboveLimit' }] } });
    const { result } = await reorderOrder({ lineItems: [line('Atorvastatin', 'RX-1')] } as never, input);
    expect(result).toEqual({ added: [], notAdded: [{ name: 'Atorvastatin', reason: 'UNAVAILABLE' }] });
  });
});
