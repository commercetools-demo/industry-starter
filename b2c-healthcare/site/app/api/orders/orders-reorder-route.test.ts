// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam' }) }));
const read = vi.fn();
vi.mock('@/lib/ct/orders-read', () => ({ getRawOrderForCustomer: (...a: unknown[]) => read(...a) }));
const reorder = vi.fn();
vi.mock('@/lib/ct/orders-reorder', () => ({ reorderOrder: (...a: unknown[]) => reorder(...a) }));

import { POST } from './[id]/reorder/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  session.getSession.mockReset().mockResolvedValue({ customerId: 'c1', locale: 'en-US', cartId: 'cart-0' });
  session.setCart.mockReset();
  read.mockReset().mockResolvedValue({ lineItems: [] });
  reorder.mockReset().mockResolvedValue({ result: { added: ['A'], notAdded: [{ name: 'B', reason: 'NO_REFILLS' }] }, cartId: 'cart-1' });
});

describe('order-history: POST /api/orders/:id/reorder', () => {
  it('Reorder with an unavailable item: answers what was added and what was not, and points the session at the cart', async () => {
    const response = await POST(makeRequest('/api/orders/o1/reorder', { method: 'POST' }), ctx('o1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ added: ['A'], notAdded: [{ name: 'B', reason: 'NO_REFILLS' }] });
    expect(read).toHaveBeenCalledWith('o1', 'c1');
    expect(session.setCart).toHaveBeenCalledWith('cart-1');
  });

  it("another customer's order or an unknown id: the identical 404, nothing is validated or added", async () => {
    read.mockResolvedValue(null);
    const response = await POST(makeRequest('/api/orders/x/reorder', { method: 'POST' }), ctx('x'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Order not found.' });
    expect(reorder).not.toHaveBeenCalled();
  });

  it('401 without a session', async () => {
    session.getSession.mockResolvedValue({});
    expect((await POST(makeRequest('/api/orders/o1/reorder', { method: 'POST' }), ctx('o1'))).status).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });
});
