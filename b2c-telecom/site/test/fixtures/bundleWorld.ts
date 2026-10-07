// An in-memory commercetools for the cart routes: the real route, bundle, cart and guard code runs against it. Only the SDK client
// (`getApiRoot`) is replaced. Import `makeApiRoot` from a `vi.mock('@/lib/ct/client', ...)` factory.
import { fakeCart, type FakeCartHandle, type FakeCodes, type FakePrice } from './fakeCart';

export const PRICES: Record<string, FakePrice> = {
  'MLV-CBL-500-24M': { recurring: 5999, oneTime: 2500 },
  'MLV-CBL-500-M2M': { recurring: 6999, oneTime: 2500 },
  'MLV-CBL-100-24M': { recurring: 3999, oneTime: 2500 },
  'MLV-CBL-100-M2M': { recurring: 4999, oneTime: 2500 },
  'MLV-CBL-GIG-24M': { recurring: 7999, oneTime: 2500 },
  'MLV-AIR-5G-12M': { recurring: 5500 },
  'MLV-PHN-UNL-24M': { recurring: 5000 },
  'MLV-PHN-UNL-M2M': { recurring: 5500 },
  'MLV-PHN-ESS-M2M': { recurring: 2500 },
  'MLV-ADD-APPLETV-MTH': { recurring: 999 },
  'MLV-ADD-SPOTIFY-MTH': { recurring: 1000 },
  'MLV-ADD-DEVCARE-MTH': { recurring: 1200 },
  'MLV-EQP-AX3000-RENT': { recurring: 800 },
  'MLV-EQP-AX3000-BUY': { oneTime: 12999 },
};

export const world = {
  handle: undefined as FakeCartHandle | undefined,
  prices: PRICES,
  codes: {} as FakeCodes,
  inventory: {} as Record<string, number>,
  inventoryCalls: 0,
  created: 0,
};

export function resetWorld(patch: { codes?: FakeCodes; inventory?: Record<string, number>; prices?: Record<string, FakePrice> } = {}): void {
  world.handle = undefined;
  world.prices = patch.prices ?? PRICES;
  world.codes = patch.codes ?? {};
  world.inventory = patch.inventory ?? { 'MLV-EQP-AX3000-RENT': 10, 'MLV-EQP-AX3000-BUY': 10 };
  world.inventoryCalls = 0;
  world.created = 0;
}

/** A cart that already exists for `anonymousId` (id `cart-1`). */
export function seedCart(patch: Record<string, unknown> = {}): FakeCartHandle {
  world.handle = fakeCart(world.prices, { id: 'cart-1', anonymousId: 'anon-1', ...patch } as never, world.codes);
  return world.handle;
}

const now = (): FakeCartHandle => {
  if (!world.handle) throw { statusCode: 404 };
  return world.handle;
};

export function makeApiRoot() {
  return {
    carts: () => ({
      get: () => ({ execute: async () => ({ body: { results: world.handle ? [structuredClone(world.handle.cart)] : [] } }) }),
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          world.created += 1;
          world.handle = fakeCart(world.prices, { ...body, id: 'cart-new', version: 1 } as never, world.codes);
          const cart = world.handle.cart as unknown as Record<string, unknown>;
          cart.totalPrice = { type: 'centPrecision', centAmount: 0, currencyCode: body.currency, fractionDigits: 2 };
          cart.cartState = 'Active';
          cart.country = body.country;
          return { body: structuredClone(world.handle.cart) };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            if (!world.handle || world.handle.cart.id !== ID) throw { statusCode: 404 };
            return { body: structuredClone(world.handle.cart) };
          },
        }),
        post: ({ body }: { body: { version: number; actions: { action: string }[] } }) => ({
          execute: async () => ({ body: structuredClone(now().apply(body.version, body.actions)) }),
        }),
        delete: () => ({
          execute: async () => {
            world.handle = undefined;
            return { body: {} };
          },
        }),
      }),
    }),
    inventory: () => ({
      get: ({ queryArgs }: { queryArgs: { where: string } }) => ({
        execute: async () => {
          world.inventoryCalls += 1;
          const skus = [...queryArgs.where.matchAll(/"([^"]+)"/g)].map((match) => match[1] as string);
          return { body: { results: skus.filter((sku) => sku in world.inventory).map((sku) => ({ sku, availableQuantity: world.inventory[sku] })) } };
        },
      }),
    }),
    cartDiscounts: () => ({
      get: () => ({ execute: async () => ({ body: { results: [{ id: 'cd-second', key: 'malva-cd-second-line-10' }, { id: 'cd-bundle', key: 'malva-cd-bundle-5' }, { id: 'cd-intro', key: 'malva-cd-intro-cable-100-24' }] } }) }),
    }),
    recurrencePolicies: () => ({
      withKey: () => ({ get: () => ({ execute: async () => ({ body: { id: 'pol-1', key: 'malva-monthly', version: 1 } }) }) }),
    }),
  };
}
