// @vitest-environment node
import { apiRoot, authRequest, ctCustomer, failure, resetWorld, sameIp, world } from '@/test/fixtures/authWorld';

vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => apiRoot }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
const padResponse = vi.fn<(startedAt: number) => Promise<void>>(async () => undefined);
vi.mock('@/lib/auth/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/auth/api')>()), padResponse: (startedAt: number) => padResponse(startedAt) }));
vi.mock('@/lib/ct/bundle', () => ({ readBundle: vi.fn() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/authWorld')).sessionMock);

import { POST } from './route';

const forgot = (body: unknown, headers: Record<string, string> = {}) => POST(authRequest('/api/auth/forgot-password', body, headers));
const unknownEmail = () => {
  throw failure(404, 'ResourceNotFound');
};
let known = 0;
const knownEmail = () => `known-${(known += 1)}@example.com`;

beforeEach(() => {
  resetWorld();
  padResponse.mockClear();
  vi.unstubAllEnvs();
  world.handler = () => ({ value: 'reset-token-123456', customerId: 'c-1', ...ctCustomer() });
});

describe('POST /api/auth/forgot-password', () => {
  it('Password reset does not confirm the email: known and unknown addresses get identical responses and no link is returned by email', async () => {
    const knownRes = await forgot({ email: knownEmail() });
    world.handler = unknownEmail;
    const unknownRes = await forgot({ email: 'nobody@example.com' });
    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    const [a, b] = await Promise.all([knownRes.text(), unknownRes.text()]);
    expect(a).toBe(b);
    expect(JSON.parse(a)).toEqual({ ok: true });
    expect(knownRes.headers.get('cache-control')).toBe('no-store');
    expect(a).not.toContain('reset-token');
  });

  it('Address with no account: the confirmation is identical, the commercetools 404 is swallowed and the response time is padded', async () => {
    world.handler = unknownEmail;
    const res = await forgot({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(padResponse).toHaveBeenCalledTimes(1);
    expect(world.calls).toHaveLength(1);
  });

  it('requests a 60 minute token that invalidates older ones', async () => {
    await forgot({ email: '  Jane@Example.com ' });
    expect(world.calls[0]).toEqual({ method: 'POST', path: 'customers/password-token', body: { email: 'jane@example.com', ttlMinutes: 60, invalidateOlderTokens: true } });
  });

  it('with DEMO_SHOW_RESET_LINK=true an existing account gets the demo link, an unknown one does not', async () => {
    vi.stubEnv('DEMO_SHOW_RESET_LINK', 'true');
    const known = await (await forgot({ email: knownEmail(), locale: 'de-DE' })).json();
    expect(known).toEqual({ ok: true, demoLink: '/de-DE/reset-password?token=reset-token-123456' });
    world.handler = unknownEmail;
    expect(await (await forgot({ email: 'nobody@example.com' })).json()).toEqual({ ok: true });
  });

  it('with the flag off nothing leaks for either address', async () => {
    vi.stubEnv('DEMO_SHOW_RESET_LINK', 'false');
    expect(await (await forgot({ email: knownEmail() })).json()).toEqual({ ok: true });
  });

  it('answers the generic OK for an implausible email without calling commercetools', async () => {
    const res = await forgot({ email: 'nope' });
    expect(await res.json()).toEqual({ ok: true });
    expect(world.calls).toEqual([]);
  });

  it('swallows every commercetools failure and never logs the token or the email', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.handler = () => {
      throw Object.assign(new Error('boom reset-token-123456'), { statusCode: 500 });
    };
    const res = await forgot({ email: 'jane@example.com' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/reset-token|jane@/);
    log.mockRestore();
  });

  it('after 3 requests for one email within an hour it still answers OK but creates no token', async () => {
    const email = knownEmail();
    for (let i = 0; i < 3; i += 1) await forgot({ email });
    world.calls = [];
    const res = await forgot({ email });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(world.calls).toEqual([]);
  });

  it('limits one IP to 5 requests per hour with 429 and Retry-After', async () => {
    for (let i = 0; i < 5; i += 1) expect((await forgot({ email: knownEmail() }, sameIp('203.0.113.77'))).status).toBe(200);
    const blocked = await forgot({ email: knownEmail() }, sameIp('203.0.113.77'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).not.toBeNull();
  });

  it('refuses another origin', async () => {
    expect((await forgot({ email: 'a@b.co' }, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
