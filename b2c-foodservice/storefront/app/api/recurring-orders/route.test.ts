// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({
  listRecurringOrders: vi.fn(),
  listPendingSubscriptions: vi.fn(),
  getRecurringOrder: vi.fn(),
  applyRecurringAction: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/recurring-orders', () => ct);

import { GET as getList } from '@/app/api/recurring-orders/route';
import { GET as getOne, PUT } from '@/app/api/recurring-orders/[id]/route';
import { AppError } from '@/lib/errors';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import { SubscriptionRejected } from '@/lib/ct/subscription-plan';
import { RO_ID, POLICY_2W, ctRecurringOrder, subscription } from '@/test/recurring';

const ctx = { params: Promise.resolve({ id: RO_ID }) };
const list = (qs = '') => getList(new Request(`http://x/api/recurring-orders${qs}`), { params: Promise.resolve({}) });
const put = (body: unknown, contentType: string | null = 'application/json') =>
  PUT(
    new Request(`http://x/api/recurring-orders/${RO_ID}`, {
      method: 'PUT',
      ...(contentType ? { headers: { 'content-type': contentType } } : {}),
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ctx,
  );

beforeEach(async () => {
  jar.store.clear();
  for (const f of Object.values(ct)) f.mockReset();
  ct.listRecurringOrders.mockResolvedValue([ctRecurringOrder()]);
  ct.listPendingSubscriptions.mockResolvedValue([]);
  ct.getRecurringOrder.mockResolvedValue(subscription());
  ct.applyRecurringAction.mockResolvedValue(subscription({ state: 'paused', nextOrderDate: null }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const signIn = async (customerId = 'cust-1') => jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId }));

describe('GET /api/recurring-orders', () => {
  it('list without a session returns 401 with no detail', async () => {
    const res = await list();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
    expect(ct.listRecurringOrders).not.toHaveBeenCalled();
  });

  it("list returns only the session customer's subscriptions", async () => {
    await signIn('cust-1');
    const res = await list('?customerId=cust-2');
    expect(ct.listRecurringOrders).toHaveBeenCalledWith('cust-1');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]).toMatchObject({ id: RO_ID, state: 'active', schedule: { unit: 'Months', value: 1 }, nextOrderDate: '2026-11-19T08:00:00.000Z' });
    expect(JSON.stringify(body)).not.toContain('cust-');
  });

  it('originOrderId filter narrows the list', async () => {
    await signIn();
    ct.listRecurringOrders.mockResolvedValue([
      ctRecurringOrder(),
      ctRecurringOrder({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', originOrder: { typeId: 'order', id: '33333333-3333-4333-8333-333333333333' } }),
    ]);
    const body = await (await list('?originOrderId=33333333-3333-4333-8333-333333333333')).json();
    expect(body.subscriptions.map((s: { id: string }) => s.id)).toEqual(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
    expect((await list('?originOrderId=no%20pe')).status).toBe(400);
  });

  it('upstream 503 becomes upstream_unavailable', async () => {
    await signIn();
    ct.listRecurringOrders.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }));
    const res = await list();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('upstream_unavailable');
  });
});

describe('GET /api/recurring-orders/[id]', () => {
  it("get of another customer's subscription is 404", async () => {
    await signIn();
    ct.getRecurringOrder.mockRejectedValue(new AppError('not_found', 404));
    const res = await getOne(new Request('http://x'), ctx);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain('cust');
  });

  it('returns the subscription of the session customer', async () => {
    await signIn();
    const res = await getOne(new Request('http://x'), ctx);
    expect(ct.getRecurringOrder).toHaveBeenCalledWith('cust-1', RO_ID, 'en-US');
    expect((await res.json()).subscription.id).toBe(RO_ID);
  });
});

describe('PUT /api/recurring-orders/[id]', () => {
  it('401 without a session', async () => {
    expect((await put({ action: 'pause' })).status).toBe(401);
  });

  it.each([
    [{ action: 'pause' }],
    [{ action: 'resume' }],
    [{ action: 'cancel' }],
    [{ action: 'skip' }],
    [{ action: 'setInterval', recurrencePolicyId: POLICY_2W }],
  ])('passes %j to the server module with the session customer', async (body) => {
    await signIn();
    const res = await put(body);
    expect(res.status).toBe(200);
    expect(ct.applyRecurringAction).toHaveBeenCalledWith('cust-1', RO_ID, body, 'en-US');
    expect((await res.json()).subscription.state).toBe('paused');
  });

  it('client supplied version and customer id are ignored', async () => {
    await signIn();
    await put({ action: 'skip', version: 1, customerId: 'cust-2', totalToSkip: 99 });
    expect(ct.applyRecurringAction).toHaveBeenCalledWith('cust-1', RO_ID, { action: 'skip' }, 'en-US');
  });

  it('non-JSON body is 415', async () => {
    await signIn();
    expect((await put('action=pause', 'application/x-www-form-urlencoded')).status).toBe(415);
    expect((await put('{}', null)).status).toBe(415);
    expect(ct.applyRecurringAction).not.toHaveBeenCalled();
  });

  it('unknown action, malformed policy and broken JSON are invalid_request', async () => {
    await signIn();
    for (const body of [{ action: 'explode' }, { action: 'setInterval', recurrencePolicyId: '../1' }, '{not json']) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('invalid_request');
    }
  });

  it('setInterval rejects an unknown policy', async () => {
    await signIn();
    ct.applyRecurringAction.mockRejectedValue(new SubscriptionRejected('subscription_unavailable', 422));
    const res = await put({ action: 'setInterval', recurrencePolicyId: POLICY_2W });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('subscription_unavailable');
  });

  it('resume of a canceled subscription is invalid_state', async () => {
    await signIn();
    ct.applyRecurringAction.mockRejectedValue(new SubscriptionRejected('invalid_state', 422));
    const res = await put({ action: 'resume' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('invalid_state');
  });

  it('second version conflict surfaces as version_conflict', async () => {
    await signIn();
    ct.applyRecurringAction.mockRejectedValue(new AppError('conflict', 409));
    const res = await put({ action: 'pause' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('version_conflict');
  });

  it('upstream 503 becomes upstream_unavailable and an unknown subscription is 404', async () => {
    await signIn();
    ct.applyRecurringAction.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 503 }));
    expect((await put({ action: 'pause' })).status).toBe(503);
    ct.applyRecurringAction.mockRejectedValueOnce(new AppError('not_found', 404));
    expect((await put({ action: 'pause' })).status).toBe(404);
  });
});
