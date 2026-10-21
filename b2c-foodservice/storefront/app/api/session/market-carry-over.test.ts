// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/client', async () => (await import('@/test/fake-carts')).clientModule());
vi.mock('@/lib/ct/inventory', async () => (await import('@/test/fake-carts')).inventoryModule());
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/ct/cart-enrich', () => ({ getCartEnrichment: async () => ({}) }));
vi.mock('@/lib/ct/channels', async () => {
  const { STORE_BK, STORE_SOHO } = await import('@/test/cart');
  return { getStoresForCountry: async (country: string) => (country === 'US' ? [STORE_SOHO, STORE_BK] : []) };
});
vi.mock('@/lib/ct/project', () => ({
  getMarkets: async () => [
    { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States', collection: true, timeZone: 'x' },
    { locale: 'en-CA', currency: 'CAD', country: 'CA', label: 'Canada', collection: false, timeZone: 'x' },
  ],
}));
vi.mock('@/lib/ct/product-detail', () => {
  const policy = { id: 'rp-2w', key: 'mcf-every-2-weeks', name: 'Every 2 weeks', schedule: { unit: 'Weeks', value: 2 } };
  const variant = (sku: string, cad: boolean) => ({
    sku,
    recurrencePrices: [{ recurrencePolicy: { id: 'rp-2w' }, value: { currencyCode: cad ? 'CAD' : 'USD', centAmount: 900 }, country: cad ? 'CA' : 'US' }],
  });
  return {
    getRecurrencePolicies: async () => [policy],
    getRecurrencePolicyByKey: async (key: string) => (key === policy.key ? policy : null),
    getProductBySku: async (sku: string) => ({
      masterVariant: variant(sku, sku === 'SUB-CA'), variants: [], attributes: [{ name: 'subscribable', value: true }],
    }),
  };
});

import { PUT } from './market/route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type Session } from '@/lib/session';
import { ctLine } from '@/test/cart';
import { fake, seedCart } from '@/test/fake-carts';

const ctx = { params: Promise.resolve({}) };
const put = (body: unknown) => PUT(new Request('http://x/api/session/market', { method: 'PUT', body: JSON.stringify(body) }), ctx);
const sessionOf = async (res: Response): Promise<Session> => {
  const m = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(res.headers.get('set-cookie') ?? '');
  return verifySessionToken(m?.[1]);
};
const signIn = async (s: Session) => jar.store.set(SESSION_COOKIE, await createSessionToken(s));
const lineOf = (cartId: string, sku: string) =>
  (fake.carts.get(cartId)!.lineItems as { variant: { sku: string }; quantity: number; supplyChannel?: unknown; custom?: { fields: { fulfilment: string } } }[]).find((l) => l.variant.sku === sku);

async function usBag() {
  fake.prices = { S1: 1000, S2: 2000, S3: 3000, 'SUB-CA': 1500, 'SUB-US': 1500 };
  fake.cadPrices = { S1: 1300, S2: 2600, S3: null };
  fake.codes = { WELCOME10: { id: 'c-1' }, USONLY: { id: 'c-2', reject: 'DoesNotMatchCart' } };
  const id = seedCart({
    lineItems: [
      ctLine({ id: 'a', sku: 'S1', quantity: 2 }),
      ctLine({ id: 'b', sku: 'S2', fulfilment: 'collect', channelId: 'ch-soho' }),
      ctLine({ id: 'c', sku: 'S3' }),
      ctLine({ id: 's1', sku: 'SUB-CA', fulfilment: 'subscribe', policyId: 'rp-2w' }),
      ctLine({ id: 's2', sku: 'SUB-US', fulfilment: 'subscribe', policyId: 'rp-2w' }),
    ],
    discountCodes: [
      { discountCode: { typeId: 'discount-code', id: 'c-1', obj: { code: 'WELCOME10' } }, state: 'MatchesCart' },
      { discountCode: { typeId: 'discount-code', id: 'c-2', obj: { code: 'USONLY' } }, state: 'MatchesCart' },
    ],
  });
  await signIn({ cartId: id, anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US', collectionStoreKey: 'mcf-store-nyc-soho' });
  return id;
}

beforeEach(() => {
  jar.store.clear();
  fake.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('region switch with a bag (I-12)', () => {
  it('Region switched with a cart creates a new cart in the new currency and carries over lines with a price', async () => {
    const oldId = await usBag();
    const res = await put({ country: 'CA' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cartCarriedOver: boolean; droppedLines: unknown[]; currency: string };
    expect(body).toMatchObject({ cartCarriedOver: true, currency: 'CAD' });
    const session = await sessionOf(res);
    expect(session.cartId).toBeDefined();
    expect(session.cartId).not.toBe(oldId);
    const fresh = fake.carts.get(session.cartId!)!;
    expect(fresh).toMatchObject({ currency: 'CAD', country: 'CA', locale: 'en-CA', shippingMode: 'Single' });
    expect(lineOf(session.cartId!, 'S1')).toMatchObject({ quantity: 2 });
    expect((lineOf(session.cartId!, 'S1') as unknown as { price: { value: { centAmount: number } } }).price.value.centAmount).toBe(1300);
  });

  it('collect lines from another country become ship', async () => {
    await usBag();
    const session = await sessionOf(await put({ country: 'CA' }));
    const moved = lineOf(session.cartId!, 'S2')!;
    expect(moved.supplyChannel).toBeUndefined();
    expect(moved.custom?.fields.fulfilment).toBe('delivery');
    expect(session.collectionStoreKey).toBeUndefined();
  });

  it('Product not sellable in the new region is listed not dropped silently', async () => {
    await usBag();
    const res = await put({ country: 'CA' });
    const body = (await res.json()) as { droppedLines: { sku: string; name: string; reason: string }[] };
    expect(body.droppedLines).toContainEqual({ sku: 'S3', name: 'Product S3', reason: 'no-price' });
    const session = await sessionOf(res);
    expect(lineOf(session.cartId!, 'S3')).toBeUndefined();
  });

  it('subscribe lines without a recurring price in the new currency are listed', async () => {
    await usBag();
    const res = await put({ country: 'CA' });
    const body = (await res.json()) as { droppedLines: { sku: string; reason: string }[] };
    const session = await sessionOf(res);
    expect(lineOf(session.cartId!, 'SUB-CA')?.custom?.fields.fulfilment).toBe('subscribe');
    expect(body.droppedLines).toContainEqual(expect.objectContaining({ sku: 'SUB-US', reason: 'no-price' }));
  });

  it('codes re-applied or ignored', async () => {
    await usBag();
    const res = await put({ country: 'CA' });
    const body = (await res.json()) as { droppedCodes: string[] };
    const session = await sessionOf(res);
    const codes = (fake.carts.get(session.cartId!)!.discountCodes as { discountCode: { obj: { code: string } } }[]).map((d) => d.discountCode.obj.code);
    expect(codes).toEqual(['WELCOME10']);
    expect(body.droppedCodes).toEqual(['USONLY']); // valid in the old bag, refused in the new market
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('USONLY'); // codes never reach the logs
  });

  it('old cart gets short deletion time', async () => {
    const oldId = await usBag();
    await put({ country: 'CA' });
    expect(fake.carts.get(oldId)!.deleteDaysAfterLastModification).toBe(1);
  });

  it('Region switched before a cart exists changes nothing in cart', async () => {
    await signIn({ anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' });
    const res = await put({ country: 'CA' });
    expect(await res.json()).toMatchObject({ cartCarriedOver: false, droppedLines: [] });
    expect((await sessionOf(res)).cartId).toBeUndefined();
    expect(fake.carts.size).toBe(0);
  });

  it('an empty bag is not carried over', async () => {
    const id = seedCart({});
    await signIn({ cartId: id, anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' });
    const res = await put({ country: 'CA' });
    expect(await res.json()).toMatchObject({ cartCarriedOver: false });
    expect((await sessionOf(res)).cartId).toBeUndefined();
    expect(fake.carts.size).toBe(1);
  });

  it('a language change in the same currency keeps the cart', async () => {
    const id = await usBag();
    const res = await put({ country: 'US', locale: 'en-US' });
    expect(await res.json()).toMatchObject({ cartCarriedOver: false });
    expect((await sessionOf(res)).cartId).toBe(id);
    expect(fake.updates).toHaveLength(0);
  });

  it('a foreign cart id is never moved', async () => {
    const id = seedCart({ anonymousId: 'someone-else', lineItems: [ctLine({ id: 'a', sku: 'S1' })] });
    fake.prices = { S1: 1000 };
    await signIn({ cartId: id, anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' });
    const res = await put({ country: 'CA' });
    expect(await res.json()).toMatchObject({ cartCarriedOver: false });
    expect(fake.carts.size).toBe(1);
  });
});
