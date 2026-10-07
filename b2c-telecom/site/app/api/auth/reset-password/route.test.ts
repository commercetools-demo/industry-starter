// @vitest-environment node
import { apiRoot, authRequest, ctCustomer, failure, resetWorld, sameIp, world } from '@/test/fixtures/authWorld';

vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => apiRoot }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/bundle', () => ({ readBundle: vi.fn() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/authWorld')).sessionMock);

import { POST } from './route';

const reset = (body: unknown, headers: Record<string, string> = {}) => POST(authRequest('/api/auth/reset-password', body, headers));
const valid = { token: 'reset-token-123456', password: 'New-Passw0rd-2026' };

function answer(customer = ctCustomer()) {
  world.handler = (call) => {
    if (call.path === 'customers/password/reset') return customer;
    if (call.path === 'customers/c-1' && call.method === 'GET') return ctCustomer({ isEmailVerified: true });
    if (call.path === 'customers/email-token') return { value: 'email-token-123' };
    if (call.path === 'customers/email/confirm') return ctCustomer({ isEmailVerified: true });
    return {};
  };
}

beforeEach(() => {
  resetWorld();
  answer();
});

describe('POST /api/auth/reset-password', () => {
  it('Token valid password changed: password is reset, sessions are invalidated and the user must log in again', async () => {
    world.session = { customerId: 'c-1', signedInAt: '1', cartId: 'cart-9', anonymousId: 'anon-1' };
    const res = await reset(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirectTo: '/en-US/login?reset=1' });
    expect(world.calls[0]).toEqual({ method: 'POST', path: 'customers/password/reset', body: { tokenValue: 'reset-token-123456', newPassword: 'New-Passw0rd-2026' } });
    const write = world.calls.find((call) => call.method === 'POST' && call.path === 'customers/c-1');
    expect(write?.body).toMatchObject({ version: 4, actions: [{ action: 'setCustomType', fields: { sessionsValidAfter: expect.any(String) } }] });
    expect(world.session).toEqual({ anonymousId: 'anon-1' });
  });

  it('keeps the cart reference of an anonymous caller', async () => {
    world.session = { anonymousId: 'anon-1', cartId: 'cart-1' };
    await reset(valid);
    expect(world.patches).toEqual([]);
    expect(world.session).toEqual({ anonymousId: 'anon-1', cartId: 'cart-1' });
  });

  it('Password fails policy: refused before any commercetools call, naming the failed rules', async () => {
    const res = await reset({ ...valid, password: 'weak' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('WEAK_PASSWORD');
    expect(body.error.details.failed).toEqual(['min-length', 'uppercase', 'digit']);
    expect(world.calls).toEqual([]);
  });

  it('Verification before recovery: an unverified account is not blocked, the reset confirms the email', async () => {
    answer(ctCustomer({ isEmailVerified: false }));
    const res = await reset(valid);
    expect(res.status).toBe(200);
    const paths = world.calls.map((call) => call.path);
    expect(paths).toContain('customers/email-token');
    expect(paths).toContain('customers/email/confirm');
    expect(paths.indexOf('customers/password/reset')).toBeLessThan(paths.indexOf('customers/email-token'));
  });

  it('does not confirm the email again when it is already confirmed', async () => {
    await reset(valid);
    expect(world.calls.map((call) => call.path)).not.toContain('customers/email-token');
  });

  it('an invalid, expired or used token answers 400 INVALID_TOKEN and invalidates nothing', async () => {
    world.handler = () => {
      throw failure(400, 'InvalidToken');
    };
    const res = await reset(valid);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TOKEN');
    expect(world.calls).toHaveLength(1);
    expect((await reset({ ...valid, token: '' })).status).toBe(400);
  });

  it('the redirect carries the requested locale', async () => {
    expect((await (await reset({ ...valid, locale: 'de-DE' })).json()).redirectTo).toBe('/de-DE/login?reset=1');
  });

  it('never logs the token or the password', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => undefined));
    world.handler = () => {
      throw Object.assign(new Error('reset-token-123456 New-Passw0rd-2026'), { statusCode: 503 });
    };
    expect((await reset(valid)).status).toBe(502);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/reset-token|Passw0rd/);
      spy.mockRestore();
    }
  });

  it('limits one IP to 10 requests per hour', async () => {
    for (let i = 0; i < 10; i += 1) expect((await reset({ ...valid, password: 'weak' }, sameIp('203.0.113.88'))).status).toBe(400);
    expect((await reset(valid, sameIp('203.0.113.88'))).status).toBe(429);
  });

  it('refuses another origin', async () => {
    expect((await reset(valid, { origin: 'https://evil.example' })).status).toBe(403);
    expect(world.calls).toEqual([]);
  });
});
