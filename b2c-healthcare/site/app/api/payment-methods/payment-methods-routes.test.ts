// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { makeRequest } from '@/test/request';

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/session', () => session);
const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);
const rec = vi.hoisted(() => ({ listRecurring: vi.fn(), pauseRecurring: vi.fn() }));
vi.mock('@/lib/ct/recurring', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/recurring')>()), ...rec }));
const logSpy = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock('@/lib/log', () => ({ log: logSpy }));

import { GET } from './route';
import { DELETE } from './[id]/route';
import { POST as setDefault } from './[id]/default/route';

const provider = createFakePaymentProvider();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const del = (id: string, confirm = false) => DELETE(makeRequest(`/api/payment-methods/${id}${confirm ? '?confirm=1' : ''}`, { method: 'DELETE' }), ctx(id));
const post = (id: string) => setDefault(makeRequest(`/api/payment-methods/${id}/default`, { method: 'POST' }), ctx(id));

beforeEach(() => {
  provider.reset();
  session.getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  providerMock.getPaymentProvider.mockReset().mockResolvedValue(provider);
  rec.listRecurring.mockReset().mockResolvedValue([]);
  rec.pauseRecurring.mockReset().mockResolvedValue({});
  for (const fn of Object.values(logSpy)) fn.mockReset();
});

describe('payment-methods: routes', () => {
  it('401 without a session on every route, before the provider is touched', async () => {
    session.getSession.mockResolvedValue({});
    const r = await Promise.all([GET(), del('pm1'), post('pm1')]);
    expect(r.map((x) => x.status)).toEqual([401, 401, 401]);
    expect(providerMock.getPaymentProvider).not.toHaveBeenCalled();
  });

  it('GET answers descriptors only, no-store; a customer with none gets an empty list', async () => {
    provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    provider.addStoredMethod('c2', { brand: 'Amex', last4: '0005' });
    const r = await GET();
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = await r.json();
    expect(body.methods).toHaveLength(1);
    expect(Object.keys(body.methods[0]).sort()).toEqual(['brand', 'expMonth', 'expYear', 'id', 'isDefault', 'last4']);
    provider.reset();
    expect(await (await GET()).json()).toEqual({ methods: [] });
  });

  it('a foreign or unknown method is the identical 404 for default and remove; nothing changes', async () => {
    const other = provider.addStoredMethod('c2', { brand: 'Visa', last4: '4242' });
    const bodies: string[] = [];
    for (const r of [await post(other.id), await del(other.id), await post('nope'), await del('nope')]) {
      expect(r.status).toBe(404);
      bodies.push(JSON.stringify(await r.json()));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain('Payment method not found.');
    expect(await provider.listStoredMethods('c2')).toHaveLength(1);
  });

  it('make default answers the new list with exactly one default', async () => {
    provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    const b = provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    const body = await (await post(b.id)).json();
    expect(body.methods.filter((m: { isDefault: boolean }) => m.isDefault).map((m: { id: string }) => m.id)).toEqual([b.id]);
  });

  it('removing the default leaves no default; the answer says it was the default', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    const body = await (await del(a.id)).json();
    expect(body).toMatchObject({ wasDefault: true, pausedRefills: 0 });
    expect(body.methods.some((m: { isDefault: boolean }) => m.isDefault)).toBe(false);
  });

  it('a method an active refill is charged to is a 409 with the count and is only removed with confirm=1', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    rec.listRecurring.mockResolvedValue([{ id: 'ro1', recurringOrderState: 'Active', cart: { obj: { recurringPaymentConfiguration: { paymentAllocations: [{ paymentMethod: { id: a.id } }] } } } }]);
    const blocked = await del(a.id);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: 'REFILL_DEPENDS', count: 1 });
    expect(await provider.listStoredMethods('c1')).toHaveLength(1);
    const ok = await del(a.id, true);
    expect(await ok.json()).toMatchObject({ pausedRefills: 1 });
    expect(rec.pauseRecurring).toHaveBeenCalledWith('ro1');
  });

  it('an unavailable payment service is a readable 503, not a stack', async () => {
    providerMock.getPaymentProvider.mockRejectedValue(new PaymentUnavailableError());
    const r = await GET();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'Payment is not available right now.' });
  });

  it('nothing in any answer or log line carries a token, a card number or the customer id', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    const answers = [await GET(), await post(a.id), await del(a.id), await del('nope')];
    const text = (await Promise.all(answers.map((r) => r.text()))).join(' ');
    expect(text).not.toMatch(/token|tok_|\d{8,}|"c1"|customerId/i);
    expect(JSON.stringify(Object.values(logSpy).map((fn) => fn.mock.calls))).not.toMatch(/token|tok_|4242|4444|c1/i);
  });
});
