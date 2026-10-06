// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summary } from '@/test/recurring';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/config/features', async (orig) => ({ ...(await orig<typeof import('@/lib/config/features')>()), subscriptionsEnabled: vi.fn(() => true) }));
vi.mock('@/lib/ct/recurring-orders', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/recurring-orders')>()),
  setCadence: vi.fn(),
  setQuantity: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
}));

import { PATCH } from './route';
import { subscriptionsEnabled } from '@/lib/config/features';
import * as ct from '@/lib/ct/recurring-orders';
import { getMarket, getSession } from '@/lib/session';

const patch = (body: unknown, id = 'ro-1') =>
  PATCH(new Request(`http://localhost/api/account/recurring/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
const writers = () => [ct.setCadence, ct.setQuantity, ct.pause, ct.resume, ct.cancel];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(subscriptionsEnabled).mockReturnValue(true);
  vi.mocked(getSession).mockResolvedValue({ customerId: 'cu-1' });
  vi.mocked(getMarket).mockResolvedValue({ country: 'US', currency: 'USD', locale: 'en-US' });
  for (const fn of writers()) vi.mocked(fn).mockResolvedValue(summary());
});

describe('PATCH /api/account/recurring/[id]', () => {
  it('Anonymous: 401 and nothing is written', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await patch({ action: 'pause' });
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    for (const fn of writers()) expect(fn).not.toHaveBeenCalled();
  });

  it('flag off: 404', async () => {
    vi.mocked(subscriptionsEnabled).mockReturnValue(false);
    expect((await patch({ action: 'pause' })).status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('Change cadence: calls setCadence for the session customer and returns the refreshed summary', async () => {
    vi.mocked(ct.setCadence).mockResolvedValue(summary({ cadenceLabel: 'Every month', policyKey: 'monthly' }));
    const res = await patch({ action: 'set-cadence', policyKey: 'monthly' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(ct.setCadence).toHaveBeenCalledWith('ro-1', 'cu-1', 'monthly', 'en-US');
    expect((await res.json()).recurringOrder).toMatchObject({ id: 'ro-1', policyKey: 'monthly' });
  });

  it('set-quantity, pause, resume and cancel call the matching function', async () => {
    await patch({ action: 'set-quantity', lineId: 'l-1', quantity: 3 });
    expect(ct.setQuantity).toHaveBeenCalledWith('ro-1', 'cu-1', 'l-1', 3, 'en-US');
    await patch({ action: 'pause' });
    expect(ct.pause).toHaveBeenCalledWith('ro-1', 'cu-1', 'en-US');
    await patch({ action: 'resume' });
    expect(ct.resume).toHaveBeenCalledWith('ro-1', 'cu-1', 'en-US');
    const res = await patch({ action: 'cancel' });
    expect(ct.cancel).toHaveBeenCalledWith('ro-1', 'cu-1', 'en-US');
    expect(res.status).toBe(200);
  });

  it.each([
    [{ action: 'explode' }, 'INVALID_ACTION'],
    [{}, 'INVALID_ACTION'],
    [{ action: 'set-cadence', policyKey: 'daily' }, 'INVALID_POLICY'],
    [{ action: 'set-cadence' }, 'INVALID_POLICY'],
    [{ action: 'set-quantity', quantity: 2 }, 'INVALID_LINE'],
    [{ action: 'set-quantity', lineId: 'l-1', quantity: 0 }, 'INVALID_QUANTITY'],
    [{ action: 'set-quantity', lineId: 'l-1', quantity: '2' }, 'INVALID_QUANTITY'],
    [{ action: 'set-quantity', lineId: 'l-1', quantity: 1.5 }, 'INVALID_QUANTITY'],
  ])('invalid body %j: 400 %s and nothing is written', async (body, error) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    for (const fn of writers()) expect(fn).not.toHaveBeenCalled();
  });

  it('Not the owner (or missing): 404 RECURRING_ORDER_NOT_FOUND', async () => {
    vi.mocked(ct.pause).mockRejectedValue(new ct.RecurringOrderNotFoundError('ro-9'));
    const res = await patch({ action: 'pause' }, 'ro-9');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'RECURRING_ORDER_NOT_FOUND' });
  });

  it('unknown line 404, wrong state 409, version conflict 409, other failures 500', async () => {
    vi.mocked(ct.setQuantity).mockRejectedValue(new ct.RecurringOrderLineNotFoundError('x'));
    expect(await (await patch({ action: 'set-quantity', lineId: 'x', quantity: 1 })).json()).toEqual({ error: 'LINE_NOT_FOUND' });
    vi.mocked(ct.resume).mockRejectedValue(new ct.RecurringOrderStateError('Active'));
    const state = await patch({ action: 'resume' });
    expect(state.status).toBe(409);
    expect(await state.json()).toEqual({ error: 'INVALID_STATE', state: 'Active' });
    vi.mocked(ct.pause).mockRejectedValue({ statusCode: 409 });
    expect((await patch({ action: 'pause' })).status).toBe(409);
    vi.mocked(ct.cancel).mockRejectedValue(new Error('boom'));
    const failed = await patch({ action: 'cancel' });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'RECURRING_ERROR' });
  });
});
