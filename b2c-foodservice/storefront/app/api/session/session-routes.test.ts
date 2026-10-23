// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/channels', () => ({
  getStoresForCountry: async (country: string) =>
    country === 'US' ? [{ key: 'mcf-store-a' }, { key: 'mcf-store-b' }] : [],
}));
// Carry over (workstream I) is tested in market-carry-over.test.ts; here the old cart is never found.
vi.mock('@/lib/ct/cart', () => ({ getOwnedCartForRebuild: async () => null, rebuildCart: vi.fn() }));
vi.mock('@/lib/ct/project', () => ({
  getMarkets: async () => [
    { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States', collection: true, timeZone: 'x' },
    { locale: 'en-CA', currency: 'CAD', country: 'CA', label: 'Canada', collection: false, timeZone: 'x' },
  ],
}));

import { PUT as putMarket } from '@/app/api/session/market/route';
import { PUT as putStore } from '@/app/api/session/store/route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type Session } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const put = (handler: typeof putStore, body: unknown) =>
  handler(new Request('http://x/api/session', { method: 'PUT', body: JSON.stringify(body) }), ctx);

async function seed(session: Session) {
  jar.store.set(SESSION_COOKIE, await createSessionToken(session));
}
async function written(res: Response): Promise<Session> {
  const header = res.headers.get('set-cookie') ?? '';
  const match = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(header);
  return verifySessionToken(match?.[1]);
}

beforeEach(() => {
  jar.store.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PUT /api/session/store', () => {
  it('store choice persists in the session', async () => {
    await seed({ country: 'US', currency: 'USD', locale: 'en-US', cartId: 'c1', customerId: 'u1' });
    const res = await put(putStore, { storeKey: 'mcf-store-b' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ storeKey: 'mcf-store-b' });
    const session = await written(res);
    expect(session).toMatchObject({ collectionStoreKey: 'mcf-store-b', cartId: 'c1', customerId: 'u1' });
  });

  it('unknown store key is rejected', async () => {
    const res = await put(putStore, { storeKey: 'mcf-store-zzz' });
    expect(res.status).toBe(400);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect((await put(putStore, { storeKey: 5 })).status).toBe(400);
    expect((await put(putStore, {})).status).toBe(400);
  });

  it('the page market decides which stores are valid, not the session', async () => {
    await seed({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect((await put(putStore, { storeKey: 'mcf-store-a', country: 'US' })).status).toBe(200);
    expect((await put(putStore, { storeKey: 'mcf-store-a', country: 'DE' })).status).toBe(400);
  });

  it('null clears the choice', async () => {
    await seed({ collectionStoreKey: 'mcf-store-a', country: 'US', currency: 'USD', locale: 'en-US' });
    const res = await put(putStore, { storeKey: null });
    expect(res.status).toBe(200);
    expect((await written(res)).collectionStoreKey).toBeUndefined();
  });

  it('Canada market returns no stores to choose from', async () => {
    await seed({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect((await put(putStore, { storeKey: 'mcf-store-a' })).status).toBe(400);
  });
});

describe('PUT /api/session/market', () => {
  it('Market change sets country currency and locale together and resets cartId', async () => {
    await seed({ country: 'US', currency: 'USD', locale: 'en-US', cartId: 'c1' });
    const res = await put(putMarket, { country: 'CA' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      country: 'CA', currency: 'CAD', locale: 'en-CA', cartCarriedOver: false, droppedLines: [], droppedCodes: [],
    });
    const session = await written(res);
    expect(session).toMatchObject({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(session.cartId).toBeUndefined();
    expect(res.headers.get('set-cookie')).toContain('malva-locale=en-CA');
  });

  it('market switch keeps customer fields', async () => {
    await seed({ customerId: 'u1', customerEmail: 'a@example.com', customerFirstName: 'A', customerLastName: 'B', anonymousId: 'anon' });
    const session = await written(await put(putMarket, { country: 'CA' }));
    expect(session).toMatchObject({ customerId: 'u1', customerEmail: 'a@example.com', anonymousId: 'anon' });
  });

  it('store is cleared when the market changes to Canada', async () => {
    await seed({ country: 'US', currency: 'USD', locale: 'en-US', collectionStoreKey: 'mcf-store-a' });
    expect((await written(await put(putMarket, { country: 'CA' }))).collectionStoreKey).toBeUndefined();
  });

  it('keeps the store when the new market has it', async () => {
    await seed({ country: 'CA', currency: 'CAD', locale: 'en-CA', collectionStoreKey: 'mcf-store-a' });
    expect((await written(await put(putMarket, { country: 'US' }))).collectionStoreKey).toBe('mcf-store-a');
  });

  it('language alone keeps cart when currency is unchanged', async () => {
    await seed({ country: 'US', currency: 'USD', locale: 'en-US', cartId: 'c1' });
    const session = await written(await put(putMarket, { country: 'US' }));
    expect(session.cartId).toBe('c1');
  });

  it('unsupported market 400', async () => {
    for (const body of [{ country: 'DE' }, { country: 'us' }, {}, { country: 5 }]) {
      const res = await put(putMarket, body);
      expect(res.status).toBe(400);
    }
  });

  it('a locale outside the country is rejected, one inside it is accepted', async () => {
    expect((await put(putMarket, { country: 'US', locale: 'en-CA' })).status).toBe(400);
    expect((await put(putMarket, { country: 'US', locale: 5 })).status).toBe(400);
    expect((await put(putMarket, { country: 'US', locale: 'en-US' })).status).toBe(200);
  });

  it('response carries cartCarriedOver and droppedLines', async () => {
    const json = await (await put(putMarket, { country: 'US' })).json();
    expect(json).toHaveProperty('cartCarriedOver', false);
    expect(json).toHaveProperty('droppedLines', []);
  });

  it('tampered cookie is an empty session', async () => {
    jar.store.set(SESSION_COOKIE, 'not-a-token');
    const res = await put(putMarket, { country: 'CA' });
    expect(res.status).toBe(200);
    const session = await written(res);
    expect(Object.keys(session).sort()).toEqual(['country', 'currency', 'locale']);
  });
});
