// @vitest-environment node
import type { PaymentMethod } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ listPaymentMethods: vi.fn(), removePaymentMethod: vi.fn(), setDefaultPaymentMethod: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/payment-methods', () => ct);

import { POST as DEFAULT } from '@/app/api/account/payment-methods/[id]/default/route';
import { DELETE } from '@/app/api/account/payment-methods/[id]/route';
import { GET } from '@/app/api/account/payment-methods/route';
import { AppError } from '@/lib/errors';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const r = (m = 'GET') => new Request('http://x/api/account/payment-methods', { method: m });
const pm = (id: string, d = false) =>
  ({ id, version: 1, method: 'card', default: d, paymentMethodStatus: 'Active', token: { value: 'tok_LEAK' }, interfaceAccount: 'acct_LEAK' }) as unknown as PaymentMethod;

beforeEach(async () => {
  jar.store.clear();
  for (const f of Object.values(ct)) f.mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
  ct.listPaymentMethods.mockResolvedValue([pm('p1', true), pm('p2')]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('payment methods routes', () => {
  it('Token value is never in any response', async () => {
    const bodies = [
      await (await GET(r(), ctx)).text(),
      await (await DELETE(r('DELETE'), idCtx('p1'))).text(),
      await (await DEFAULT(r('POST'), idCtx('p2'))).text(),
    ];
    for (const b of bodies) {
      expect(b).not.toContain('LEAK');
      expect(b).not.toContain('token');
    }
    expect(JSON.parse(bodies[0])).toEqual({
      methods: [
        { id: 'p1', version: 1, label: '', method: 'card', isDefault: true },
        { id: 'p2', version: 1, label: '', method: 'card', isDefault: false },
      ],
      hostedOnly: true,
    });
  });

  it('401 with no detail', async () => {
    jar.store.clear();
    const res = await GET(r(), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
  });

  it('No methods saved: an empty list, not an error', async () => {
    ct.listPaymentMethods.mockResolvedValue([]);
    expect(await (await GET(r(), ctx)).json()).toEqual({ methods: [], hostedOnly: true });
  });

  it('upstream failure is 503 upstream_unavailable', async () => {
    ct.listPaymentMethods.mockRejectedValue({ statusCode: 502 });
    const res = await GET(r(), ctx);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('upstream_unavailable');
  });

  it('remove and make default call the ct module for the session customer; a foreign method is 404', async () => {
    await DELETE(r('DELETE'), idCtx('p1'));
    expect(ct.removePaymentMethod).toHaveBeenCalledWith('c1', 'p1');
    await DEFAULT(r('POST'), idCtx('p2'));
    expect(ct.setDefaultPaymentMethod).toHaveBeenCalledWith('c1', 'p2');
    ct.removePaymentMethod.mockRejectedValue(new AppError('not_found', 404));
    expect((await DELETE(r('DELETE'), idCtx('foreign'))).status).toBe(404);
    expect((await DELETE(r('DELETE'), idCtx('a b'))).status).toBe(404);
  });
});
