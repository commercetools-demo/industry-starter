// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { createFakeCarts, type FakeCarts } from '@/test/fake-carts';
import { makeJsonRequest, makeRequest } from '@/test/request';
import type { RxLineView } from '@/lib/types';

let fake: FakeCarts;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake.apiRoot as Record<string, unknown>)[p as string] }) }));

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);

const { RxNotFoundError, validateRxSelection, getPatient } = vi.hoisted(() => ({
  RxNotFoundError: class extends Error {},
  validateRxSelection: vi.fn(),
  getPatient: vi.fn(),
}));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));

import { GET } from './route';
import { POST } from './rx-lines/route';
import { DELETE, PATCH } from './lines/[id]/route';

const sel = (lineRef: string, sku: string) => ({ lineRef, sku, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const refusedRow = (lineRef: string): RxLineView => ({ lineRef, name: 'X', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null });
const signedIn = (cartId?: string) => session.getSession.mockResolvedValue({ customerId: 'c-sam', locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });
const add = (body: unknown) => POST(makeJsonRequest('/api/cart/rx-lines', body));
const ids = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  fake = createFakeCarts({ 'MED-ator': 1875, 'MED-lis': 1140 });
  session.getSession.mockReset();
  session.setCart.mockReset().mockResolvedValue({});
  session.clearCart.mockReset().mockResolvedValue({});
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-1', 'MED-ator'), sel('RX-77102-2', 'MED-lis')], refused: [] });
  signedIn();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('cart-management: POST /api/cart/rx-lines', () => {
  it('re-validates, creates the cart on the first add, sets cartId in the session and returns the cart', async () => {
    const response = await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1', 'RX-77102-2'] });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(validateRxSelection).toHaveBeenCalledWith({ patientRef: 'pt_sam', name: 'Sam Rivera' }, 'RX-77102', ['RX-77102-1', 'RX-77102-2'], expect.objectContaining({ currency: 'USD' }));
    expect(body.cart).toMatchObject({ lineCount: 2, total: { centAmount: 3015 } });
    expect(session.setCart).toHaveBeenCalledWith(body.cart.id);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts the plan name `rx` for the number', async () => {
    expect((await add({ rx: 'RX-77102', lineRefs: ['RX-77102-1'] })).status).toBe(200);
  });

  it('401 without a customer, before any commercetools call', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(POST, [validateRxSelection], makeJsonRequest('/api/cart/rx-lines', { rxNumber: 'RX-77102', lineRefs: ['a'] }));
    expect(fake.carts.size).toBe(0);
  });

  it.each([{}, { rxNumber: 'RX-77102' }, { rxNumber: 'RX-77102', lineRefs: [] }, { rxNumber: 'RX-77102', lineRefs: [1] }, { rxNumber: 'RX-77102', lineRefs: ['a/b'] }, { rxNumber: 5, lineRefs: ['a'] }])('400 for a malformed body %j', async (body) => {
    expect((await add(body)).status).toBe(400);
    expect(validateRxSelection).not.toHaveBeenCalled();
  });

  it('403 when the account has no patient record', async () => {
    getPatient.mockResolvedValue(null);
    expect((await add({ rxNumber: 'RX-77102', lineRefs: ['a'] })).status).toBe(403);
  });

  it('404 for an unknown or foreign prescription (same answer)', async () => {
    validateRxSelection.mockRejectedValue(new RxNotFoundError());
    const response = await add({ rxNumber: 'RX-00000', lineRefs: ['a'] });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain('RX-00000');
    expect(fake.carts.size).toBe(0);
  });

  it('adds the accepted lines and reports the refused ones', async () => {
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-1', 'MED-ator')], refused: [refusedRow('RX-77102-2')] });
    const body = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1', 'RX-77102-2'] })).json();
    expect(body.cart.lineCount).toBe(1);
    expect(body.refused).toHaveLength(1);
  });

  it('422 and no cart when nothing can be added', async () => {
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [refusedRow('RX-77102-1')] });
    const response = await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] });
    expect(response.status).toBe(422);
    expect((await response.json()).refused).toHaveLength(1);
    expect(fake.carts.size).toBe(0);
    expect(session.setCart).not.toHaveBeenCalled();
  });

  it('a platform quantity-limit refusal becomes a 422 with the ceiling', async () => {
    fake.failNextUpdate = { statusCode: 400, body: { errors: [{ code: 'LineItemQuantityAboveLimit', maxCartQuantity: 2 }] } };
    const response = await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] });
    expect(response.status).toBe(422);
    expect((await response.json()).refused.at(-1)).toMatchObject({ status: 'CEILING', ceiling: 2, scope: 'order' });
  });

  it('a stale cartId is tolerated: the customer cart is found or a new one made, and the session follows', async () => {
    signedIn('gone');
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-1', 'MED-ator')], refused: [] });
    const body = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] })).json();
    expect(body.cart.lineCount).toBe(1);
    expect(session.setCart).toHaveBeenCalledWith(body.cart.id);
  });

  it('adding the same line twice does not duplicate it', async () => {
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-1', 'MED-ator')], refused: [] });
    const first = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] })).json();
    signedIn(first.cart.id);
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-1', 'MED-ator')], refused: [] });
    const second = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] })).json();
    expect(second.cart.lineCount).toBe(1);
  });

  it('sanitizes a commercetools failure: no body, no RX number', async () => {
    validateRxSelection.mockRejectedValue(Object.assign(new Error('boom RX-77102 secret'), { statusCode: 500 }));
    await expectSanitizedError(POST, ['RX-77102', 'secret'], makeJsonRequest('/api/cart/rx-lines', { rxNumber: 'RX-77102', lineRefs: ['a'] }));
  });
});

describe('cart-management: GET /api/cart', () => {
  it('401 without a customer', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(GET, [], makeRequest('/api/cart'));
  });

  it('null when there is no cart; a stale cartId is cleared from the session', async () => {
    signedIn('gone');
    const response = await GET(makeRequest('/api/cart'));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(session.clearCart).toHaveBeenCalledTimes(1);
  });

  it('returns the validated cart and sets a missing cartId from the customer cart', async () => {
    const { cart } = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1', 'RX-77102-2'] })).json().then((b) => b);
    session.setCart.mockClear();
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-2', 'MED-lis')], refused: [refusedRow('RX-77102-1')] });
    signedIn(); // sign-out and in: no cartId, the cart is found by customer
    const body = await (await GET(makeRequest('/api/cart'))).json();
    expect(body.id).toBe(cart.id);
    expect(body.unavailableCount).toBe(1);
    expect(body.lines[0].unavailable).toMatchObject({ reason: 'NO_REFILLS' });
    expect(session.setCart).toHaveBeenCalledWith(cart.id);
  });

  it('?view=summary is the cheap read: counts only, no re-validation, no write', async () => {
    const { cart } = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1', 'RX-77102-2'] })).json();
    validateRxSelection.mockClear();
    const updates = fake.updates.length;
    signedIn(cart.id);
    const body = await (await GET(makeRequest('/api/cart?view=summary'))).json();
    expect(body).toEqual({ id: cart.id, version: expect.any(Number), itemCount: 2, lineCount: 2, currencyCode: 'USD' });
    expect(validateRxSelection).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(updates);
  });

  it('summary of a customer without a cart is null', async () => {
    expect(await (await GET(makeRequest('/api/cart?view=summary'))).json()).toBeNull();
  });
});

describe('cart-management: DELETE /api/cart/lines/[id]', () => {
  it('removes the line and answers with the recalculated cart', async () => {
    const { cart } = await (await add({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1', 'RX-77102-2'] })).json();
    signedIn(cart.id);
    const response = await DELETE(makeRequest('/api/cart/lines/x', { method: 'DELETE' }), ids(cart.lines[0].id));
    const body = await response.json();
    expect(body.cart).toMatchObject({ lineCount: 1, total: { centAmount: 1140 } });
  });

  it('401 without a customer', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated((r) => DELETE(r, ids('li-1')), [], makeRequest('/api/cart/lines/li-1', { method: 'DELETE' }));
  });

  it('a stale cartId: nothing to remove, the cart reference is cleared', async () => {
    signedIn('gone');
    const response = await DELETE(makeRequest('/api/cart/lines/li-1', { method: 'DELETE' }), ids('li-1'));
    expect((await response.json()).cart).toBeNull();
    expect(session.clearCart).toHaveBeenCalled();
  });

  it('400 for a malformed line id', async () => {
    expect((await DELETE(makeRequest('/api/cart/lines/x', { method: 'DELETE' }), ids('a b;c'))).status).toBe(400);
  });
});

describe('design-cart › No quantity editing: API', () => {
  it('Quantity shown read-only: a quantity change is rejected', async () => {
    const response = await PATCH();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'QUANTITY_FIXED' });
  });

  it('a quantity change needs a customer too', async () => {
    session.getSession.mockResolvedValue({});
    expect((await PATCH()).status).toBe(401);
  });
});
