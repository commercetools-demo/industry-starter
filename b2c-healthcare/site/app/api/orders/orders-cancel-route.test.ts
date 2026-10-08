// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { makeRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const cancel = vi.fn();
vi.mock('@/lib/ct/order-cancel', () => ({ cancelOrderForCustomer: (...a: unknown[]) => cancel(...a) }));
const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);

import { POST } from './[id]/cancel/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id = 'o1') => POST(makeRequest(`/api/orders/${id}/cancel`, { method: 'POST' }), ctx(id));

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1', locale: 'en-US' });
  cancel.mockReset().mockResolvedValue({ kind: 'cancelled', alreadyCancelled: false, order: { id: 'o1', status: 'cancelled' } });
  providerMock.getPaymentProvider.mockReset().mockResolvedValue({ kind: 'demo' });
});

describe('post-purchase-order-management: POST /api/orders/:id/cancel', () => {
  it('answers the cancelled order, no-store, for the session customer', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ id: 'o1', status: 'cancelled' });
    expect(cancel).toHaveBeenCalledWith('o1', 'c1', { kind: 'demo' }, 'en-US');
  });

  it('after packed-shipped: 409 too-late', async () => {
    cancel.mockResolvedValue({ kind: 'too-late' });
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'too-late' });
  });

  it('foreign and unknown ids: the identical 404 "Order not found."', async () => {
    cancel.mockResolvedValue({ kind: 'not-found' });
    const a = await post('foreign');
    const b = await post('unknown');
    expect([a.status, b.status]).toEqual([404, 404]);
    expect(await a.json()).toEqual(await b.json());
    expect(await post()).toBeDefined();
  });

  it('cancelling does not depend on the payment service being configured', async () => {
    providerMock.getPaymentProvider.mockRejectedValue(new PaymentUnavailableError());
    expect((await post()).status).toBe(200);
    expect(cancel.mock.calls[0]?.[2]).toBeNull();
  });

  it('401 without a session', async () => {
    getSession.mockResolvedValue({});
    expect((await post()).status).toBe(401);
    expect(cancel).not.toHaveBeenCalled();
  });
});
