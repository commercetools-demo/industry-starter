// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/session', () => session);

import { fakePaymentProvider } from '@/lib/checkout/fake-provider';
import { POST } from './route';

beforeEach(() => {
  session.getSession.mockReset().mockResolvedValue({ customerId: 'fixture-sam-rivera' });
  fakePaymentProvider.reset();
});
afterEach(() => vi.unstubAllEnvs());

describe('payment-methods: the development-only demo card route', () => {
  it('is 404 unless MALVA_FIXTURES=1, and always 404 in production, and saves nothing', async () => {
    vi.stubEnv('MALVA_FIXTURES', '');
    expect((await POST()).status).toBe(404);
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await POST()).status).toBe(404);
    expect(await fakePaymentProvider.listStoredMethods('fixture-sam-rivera')).toEqual([]);
  });

  it('with the switch on it saves one descriptor for the signed-in customer; 401 without a session', async () => {
    vi.stubEnv('MALVA_FIXTURES', '1');
    const r = await POST();
    expect(await r.json()).toMatchObject({ brand: 'Visa', last4: '4242', isDefault: true });
    expect(await fakePaymentProvider.listStoredMethods('fixture-sam-rivera')).toHaveLength(1);
    session.getSession.mockResolvedValue({});
    expect((await POST()).status).toBe(401);
  });
});
