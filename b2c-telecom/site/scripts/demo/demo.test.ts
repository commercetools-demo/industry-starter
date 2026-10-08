import { EXIT } from '../seed/config';
import type { CtApi } from '../seed/lib';
import { main as placeOrder, placeTestOrder } from './place-test-order';
import { main as setPrice, setListLinePrice } from './set-list-line-price';
import { main as setPublished, setOfferPublished } from './set-offer-published';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };

function api(resources: Record<string, unknown>): CtApi & { posts: Array<{ path: string; body: unknown }> } {
  const posts: Array<{ path: string; body: unknown }> = [];
  return {
    posts,
    get writes() {
      return posts.length;
    },
    set writes(_value: number) {},
    get: async (path: string) => (path === '' ? { key: 'spec-test-b2c-telecom' } : (resources[path] ?? null)),
    post: async (path: string, body: unknown) => {
      posts.push({ path, body });
      return {};
    },
    del: async () => ({}),
  } as CtApi & { posts: Array<{ path: string; body: unknown }> };
}

describe('demo helpers', () => {
  it('sets the saved price of the n-th line of a list', async () => {
    const fake = api({ 'shopping-lists/key=malva-list-1': { id: 'l', version: 4, lineItems: [{ id: 'a' }, { id: 'b' }] } });
    await setListLinePrice(fake, 'malva-list-1', 1, 4999);
    expect(fake.posts).toEqual([{ path: 'shopping-lists/key=malva-list-1', body: { version: 4, actions: [{ action: 'setLineItemCustomField', lineItemId: 'b', name: 'savedAmountCents', value: 4999 }] } }]);
    await expect(setListLinePrice(fake, 'malva-list-1', 5, 1)).rejects.toThrow('no line 5');
  });

  it('publishes and unpublishes an offer product, but only a malva- key', async () => {
    const fake = api({ 'products/key=malva-offer-x': { version: 2 } });
    await setOfferPublished(fake, 'malva-offer-x', false);
    await setOfferPublished(fake, 'malva-offer-x', true);
    expect(fake.posts.map((p) => (p.body as { actions: Array<{ action: string }> }).actions[0]?.action)).toEqual(['unpublish', 'publish']);
    await expect(setOfferPublished(fake, 'furniture-sofa', false)).rejects.toThrow('not a malva- key');
  });

  it('refuses to run without the project confirmation', async () => {
    const fake = api({});
    expect(await setPrice(['malva-list-1', '0', '100'], { api: fake, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(await setPublished(['malva-offer-x', 'true'], { api: fake, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(fake.posts).toHaveLength(0);
  });

  it('runs with the confirmation', async () => {
    const fake = api({ 'products/key=malva-offer-x': { version: 2 } });
    expect(await setPublished(['--confirm-project', 'spec-test-b2c-telecom', 'malva-offer-x', 'false'], { api: fake, source: SOURCE, log: () => undefined })).toBe(EXIT.OK);
    expect(fake.posts).toHaveLength(1);
  });

  it('places an order from an Active cart with the generated number and prints nothing else', async () => {
    const fake = api({ 'carts/c1': { id: 'c1', version: 3, cartState: 'Active' } });
    const lines: string[] = [];
    expect(await placeOrder(['--confirm-project', 'spec-test-b2c-telecom', '--cart-id', 'c1'], { api: fake, source: SOURCE, log: (line) => lines.push(line) })).toBe(EXIT.OK);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^MLV-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(fake.posts).toEqual([{ path: 'orders', body: { cart: { typeId: 'cart', id: 'c1' }, version: 3, orderNumber: lines[0], paymentState: 'Paid' } }]);
    expect(JSON.stringify(fake.posts)).not.toContain('Recurring');
  });

  it('refuses a cart that is missing or already ordered, and a missing project confirmation', async () => {
    const fake = api({ 'carts/c2': { id: 'c2', version: 1, cartState: 'Ordered' } });
    await expect(placeTestOrder(fake, 'nope')).rejects.toThrow('No cart');
    await expect(placeTestOrder(fake, 'c2')).rejects.toThrow('only an Active cart');
    expect(await placeOrder(['--cart-id', 'c2'], { api: fake, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(fake.posts).toHaveLength(0);
  });
});
