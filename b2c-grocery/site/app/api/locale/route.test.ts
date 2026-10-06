// @vitest-environment node
import { POST } from './route';

import { createSessionToken } from '@/lib/session';

let token: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === 'malva-session' && token ? { name: n, value: token } : undefined) }),
}));
const setSession = async (data: Record<string, string>) => {
  token = Object.keys(data).length ? await createSessionToken(data) : undefined;
};

const post = (body: unknown) => POST(new Request('http://x/api/locale', { method: 'POST', body: JSON.stringify(body) }));

async function sessionFrom(res: Response) {
  const { jwtVerify } = await import('jose');
  const token = res.headers.getSetCookie().find((c) => c.startsWith('malva-session='))!.split(';')[0].split('=')[1];
  return (await jwtVerify(token, new TextEncoder().encode('dev-only-session-secret-0123456789ab'))).payload;
}

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/locale', () => {
  it('Switch to Germany: updates all three fields together and removes cartId', async () => {
    await setSession({ locale: 'en-US', currency: 'USD', country: 'US', cartId: 'c1', customerId: 'u1' });
    const res = await post({ locale: 'de-DE' });
    expect(await res.json()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    const payload = await sessionFrom(res);
    expect(payload).toMatchObject({ locale: 'de-DE', currency: 'EUR', country: 'DE', customerId: 'u1' });
    expect(payload.cartId).toBeUndefined();
  });

  it('keeps cartId when the currency does not change', async () => {
    await setSession({ locale: 'en-US', currency: 'USD', country: 'US', cartId: 'c1' });
    const payload = await sessionFrom(await post({ locale: 'en-US' }));
    expect(payload.cartId).toBe('c1');
  });

  it('sets the locale cookie and the session cookie is HttpOnly', async () => {
    await setSession({});
    const res = await post({ locale: 'de-DE' });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('your-shop-country-locale=de-DE'))).toBe(true);
    expect(cookies.find((c) => c.startsWith('malva-session='))).toMatch(/HttpOnly/i);
  });

  it('rejects unknown locales and invalid bodies with 400', async () => {
    expect((await post({ locale: 'fr-FR' })).status).toBe(400);
    expect((await POST(new Request('http://x', { method: 'POST', body: 'nope' }))).status).toBe(400);
  });
});
