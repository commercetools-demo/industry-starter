// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BundleView } from '@/lib/types';

const ct = vi.hoisted(() => ({
  carts: new Map<string, Record<string, unknown>>(),
  updates: [] as { id: string; actions: Record<string, unknown>[] }[],
  n: 0,
  view: null as BundleView | null,
  stock: {} as Record<string, number>,
}));

// The shipping allocation that follows every write (tested in lib/cart/shipping-allocation.test.ts) is not recorded in `ct.updates`.
const SHIPPING_ACTIONS = new Set(['addItemShippingAddress', 'removeItemShippingAddress', 'addShippingMethod', 'removeShippingMethod', 'setLineItemShippingDetails']);

// A small in-memory cart engine: addLineItem and changeLineItemQuantity only.
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    carts: () => ({
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          ct.n += 1;
          const cart = { id: `cart-${ct.n}`, version: 1, cartState: 'Active', lineItems: [], totalLineItemQuantity: 0, totalPrice: { centAmount: 0, currencyCode: 'USD' }, ...body };
          ct.carts.set(cart.id, cart);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: ct.carts.get(ID) }) }),
        post: ({ body }: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
          execute: async () => {
            if (body.actions.some((a) => !SHIPPING_ACTIONS.has(a.action as string))) ct.updates.push({ id: ID, actions: body.actions });
            const c = ct.carts.get(ID) as { version: number; lineItems: Record<string, unknown>[] };
            let lines = [...c.lineItems];
            for (const a of body.actions) {
              if (a.action === 'addLineItem') {
                lines.push({
                  id: `li-${ct.n}-${lines.length + 1}`, key: a.key, quantity: a.quantity, variant: { sku: a.sku }, productId: 'p',
                  custom: a.custom, supplyChannel: a.supplyChannel, externalPrice: a.externalPrice,
                  price: { value: a.externalPrice ?? { centAmount: 0, currencyCode: 'USD' } }, totalPrice: { centAmount: 0, currencyCode: 'USD' },
                  name: { 'en-US': 'x' }, productSlug: { 'en-US': 'x' }, priceMode: a.externalPrice ? 'ExternalPrice' : 'Platform',
                  taxedPrice: undefined, discountedPricePerQuantity: [], perMethodTaxRate: [], state: [],
                });
              }
              if (a.action === 'changeLineItemQuantity') lines = lines.map((l) => (l.id === a.lineItemId ? { ...l, quantity: a.quantity } : l));
              if (a.action === 'removeLineItem') lines = lines.filter((l) => l.id !== a.lineItemId);
              if (a.action === 'setLineItemSupplyChannel') lines = lines.map((l) => (l.id === a.lineItemId ? { ...l, supplyChannel: a.supplyChannel } : l));
              if (a.action === 'setLineItemCustomField') {
                lines = lines.map((l) => {
                  if (l.id !== a.lineItemId) return l;
                  const fields = { ...((l.custom as { fields?: Record<string, unknown> } | undefined)?.fields ?? {}), [a.name as string]: a.value };
                  return { ...l, custom: { fields } };
                });
              }
            }
            const next = { ...c, version: c.version + 1, lineItems: lines, totalLineItemQuantity: lines.reduce((n, l) => n + (l.quantity as number), 0) };
            ct.carts.set(ID, next);
            return { body: next };
          },
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/ct/product-detail', () => ({
  getProductBySku: async (sku: string) => (sku === '998674532'
    ? { id: 'bundle-product', productType: { obj: { key: 'malva-coffee-machine-bundle' } }, masterVariant: { sku }, variants: [] }
    : { id: 'p1', productType: { obj: { key: 'mcf-pods' } }, masterVariant: { sku }, variants: [] }),
  getRecurrencePolicies: async () => [],
  getRecurrencePolicyByKey: async () => null,
}));
vi.mock('@/lib/ct/product-selections', () => ({ getProductBrand: async () => 'malva-coffee' }));
vi.mock('@/lib/ct/preset-bundles', () => ({ getBundleView: async () => ct.view }));
vi.mock('@/lib/ct/inventory', () => ({
  SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/,
  getInventoryDetail: async (skus: string[]) => Object.fromEntries(skus.map((sku) => [sku, { online: ct.stock[sku] ?? 100, stores: {} }])),
  getStoreStock: async (sku: string) => ct.stock[sku] ?? 100,
}));
vi.mock('@/lib/ct/channels', () => ({ getBrandChannelId: async () => undefined, getStoresForCountry: async () => [(await import('@/test/cart')).STORE_SOHO, (await import('@/test/cart')).STORE_BK] }));
vi.mock('@/lib/ct/cart-enrich', async () => ({ getCartEnrichment: async () => (await import('@/lib/mappers/cart')).EMPTY_ENRICHMENT }));
vi.mock('@/lib/ct/order-type', () => ({ orderTypeCartActions: async () => [], withOrderType: async (d: unknown) => d }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));

import { LineRejected, addLine, addPresetBundle, changeCollectionStore, changeQuantity, rebuildCart, removeLine, switchFulfilment } from '@/lib/ct/cart';
import { BUNDLE_SKU, componentProducts, inventoryFor } from '@/test/preset-bundle';
import { BUNDLE_CONFIG_VALUE } from '@/test/preset-bundle';
import { mapBundleView, parseBundleConfig } from '@/lib/mappers/preset-bundle';
import type { Session } from '@/lib/session';

const MARKET = { country: 'US', currency: 'USD', locale: 'en-US' };
const session = () => ({ anonymousId: 'anon-1' }) as unknown as Session;

beforeEach(() => {
  ct.carts.clear();
  ct.updates.length = 0;
  ct.stock = {};
  ct.view = mapBundleView(parseBundleConfig(BUNDLE_CONFIG_VALUE)!, componentProducts(), inventoryFor(), { locale: 'en-US', currency: 'USD' }, BUNDLE_SKU);
});

describe('addPresetBundle (V-09)', () => {
  it('adds one bundle: the parent at the bundle price, the parts at $0, in one update', async () => {
    const { cart, session: next } = await addPresetBundle(session(), MARKET, { sku: BUNDLE_SKU, preset: 0, quantity: 1, fulfilment: 'delivery' });
    expect(ct.updates).toHaveLength(1);
    const [parent, ...children] = ct.updates[0].actions as { action: string; key?: string; externalPrice: { centAmount: number }; custom: { fields: Record<string, unknown> } }[];
    expect(parent.key).toMatch(/^bundle-[0-9a-f-]{36}$/);
    expect(parent.externalPrice.centAmount).toBe(34916);
    expect(children.map((c) => c.externalPrice.centAmount)).toEqual([0, 0, 0]);
    expect(children.every((c) => c.custom.fields.parentId === parent.key)).toBe(true);
    expect(cart.id).toBe(next.cartId);
  });

  it('the same preset again raises the quantity of the existing bundle', async () => {
    const first = await addPresetBundle(session(), MARKET, { sku: BUNDLE_SKU, preset: 0, quantity: 1, fulfilment: 'delivery' });
    const again = { anonymousId: 'anon-1', cartId: first.session.cartId } as unknown as Session;
    const { cart } = await addPresetBundle(again, MARKET, { sku: BUNDLE_SKU, preset: 0, quantity: 1, fulfilment: 'delivery' });
    // The badge counts the bundle once; that is V-12 (mapCartSummary), so only the update is checked here.
    expect(ct.updates[1].actions.every((a) => a.action === 'changeLineItemQuantity' && a.quantity === 2)).toBe(true);
    expect(ct.updates[1].actions).toHaveLength(4);
    expect(cart.id).toBe(again.cartId);
  });

  it('an unavailable preset is refused with no update', async () => {
    ct.view = { ...ct.view!, presets: ct.view!.presets.map((p) => ({ ...p, available: false, unavailableReason: 'out-of-stock' as const, machines: p.machines.map((m) => ({ ...m, inStock: false })) })) };
    const attempt = addPresetBundle(session(), MARKET, { sku: BUNDLE_SKU, preset: 0, quantity: 1, fulfilment: 'delivery' });
    await expect(attempt).rejects.toMatchObject({ code: 'bundle_preset_unavailable', status: 422 });
    expect(ct.updates).toHaveLength(0);
  });

  it('an unknown preset index is refused with no update', async () => {
    await expect(addPresetBundle(session(), MARKET, { sku: BUNDLE_SKU, preset: 7, quantity: 1, fulfilment: 'delivery' })).rejects.toBeInstanceOf(LineRejected);
    expect(ct.updates).toHaveLength(0);
  });

  it('a bare add of the bundle SKU through addLine is refused: bundle_requires_preset', async () => {
    const attempt = addLine(session(), MARKET, { sku: BUNDLE_SKU, quantity: 1, fulfilment: 'delivery' });
    await expect(attempt).rejects.toMatchObject({ code: 'bundle_requires_preset', status: 422 });
    expect(ct.updates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- V-10: the lines of a bundle stay together

const MACHINE_SKU = 'MCF-MAC-VERTUO-BLA-M';
const POD_SKU = 'MCF-GFT-STARTER';

/** A bag with one bundle (preset 0, quantity 1). Returns the session and the ids of the parent and its parts. */
async function bagWithBundle() {
  const first = await addPresetBundle(session(), MARKET, { sku: BUNDLE_SKU, preset: 0, quantity: 1, fulfilment: 'delivery' });
  const bag = { anonymousId: 'anon-1', cartId: first.session.cartId } as unknown as Session;
  const lines = (ct.carts.get(first.session.cartId as string)?.lineItems ?? []) as { id: string; key?: string; variant?: { sku: string } }[];
  const parent = lines.find((l) => l.key?.startsWith('bundle-'))!;
  const parts = lines.filter((l) => l !== parent);
  return { bag, parent, parts };
}

describe('preset bundle lines stay together (V-10)', () => {
  it('the parent quantity change cascades to the machine and every pod in one update', async () => {
    const { bag, parent } = await bagWithBundle();
    ct.updates.length = 0;
    await changeQuantity(bag, MARKET, parent.id, 2);
    const actions = ct.updates[0].actions;
    expect(actions).toHaveLength(4);
    expect(actions.every((a) => a.action === 'changeLineItemQuantity' && a.quantity === 2)).toBe(true);
  });

  it('raising the bundle above a part\'s stock is refused with that part\'s available count', async () => {
    const { bag, parent, parts } = await bagWithBundle();
    ct.updates.length = 0;
    ct.stock[POD_SKU] = 1;
    const pod = parts.find((p) => p.variant?.sku === POD_SKU)!;
    expect(pod).toBeDefined();
    await expect(changeQuantity(bag, MARKET, parent.id, 2)).rejects.toMatchObject({ code: 'quantity_exceeds_stock', extra: { available: 1 } });
    expect(ct.updates).toHaveLength(0);
  });

  it('removing the bundle removes the parent and every part', async () => {
    const { bag, parent } = await bagWithBundle();
    ct.updates.length = 0;
    await removeLine(bag, MARKET, parent.id);
    expect(ct.updates[0].actions).toHaveLength(4);
    expect(ct.updates[0].actions.every((a) => a.action === 'removeLineItem')).toBe(true);
    expect(ct.carts.get(bag.cartId as string)?.lineItems).toEqual([]);
  });

  it('a part cannot be changed, removed or switched on its own: bundle_line_locked', async () => {
    const { bag, parts } = await bagWithBundle();
    const part = parts[0];
    await expect(changeQuantity(bag, MARKET, part.id, 2)).rejects.toMatchObject({ code: 'bundle_line_locked', status: 409 });
    await expect(removeLine(bag, MARKET, part.id)).rejects.toMatchObject({ code: 'bundle_line_locked' });
    await expect(switchFulfilment(bag, MARKET, part.id, { fulfilment: 'delivery' })).rejects.toMatchObject({ code: 'bundle_line_locked' });
    expect(ct.updates).toHaveLength(1); // only the add
  });

  it('switching the shopper\'s own machine line to collect and back never touches the bundle machine part', async () => {
    const { bag, parent, parts } = await bagWithBundle();
    const own = await addLine(bag, MARKET, { sku: MACHINE_SKU, quantity: 1, fulfilment: 'delivery' });
    const ownId = (ct.carts.get(own.session.cartId as string)?.lineItems as { id: string; key?: string; variant?: { sku: string } }[])
      .find((l) => l.variant?.sku === MACHINE_SKU && !(l as { custom?: { fields?: Record<string, unknown> } }).custom?.fields?.parentId)!.id;
    const bundleIds = [parent.id, ...parts.map((p) => p.id)];
    ct.updates.length = 0;
    await switchFulfilment(bag, MARKET, ownId, { fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' });
    await switchFulfilment(bag, MARKET, ownId, { fulfilment: 'delivery' });
    for (const update of ct.updates) {
      for (const a of update.actions) expect(bundleIds).not.toContain(a.lineItemId);
    }
    expect(ct.updates.length).toBeGreaterThan(0);
  });

  it('switching the bundle to collect moves the parent and every part to the store', async () => {
    const { bag, parent, parts } = await bagWithBundle();
    ct.updates.length = 0;
    await switchFulfilment(bag, MARKET, parent.id, { fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' });
    const actions = ct.updates[0].actions;
    const touched = actions.filter((a) => a.action === 'setLineItemSupplyChannel').map((a) => a.lineItemId);
    expect(touched.sort()).toEqual([parent.id, ...parts.map((p) => p.id)].sort());
    expect(actions.filter((a) => a.action === 'setLineItemCustomField').every((a) => a.value === 'collect')).toBe(true);
  });
});

// ---------------------------------------------------------------- V-16: the region switch re-adds a bundle

describe('region switch of a preset bundle (V-16)', () => {
  const CA = { country: 'CA', currency: 'CAD', locale: 'en-CA' };
  /** The view a Canadian shopper gets: the same presets, priced in CAD (or with no price when `noPrice`). */
  const canadianView = (noPrice: boolean): BundleView => ({
    ...ct.view!,
    presets: noPrice ? [] : ct.view!.presets.map((p) => ({
      ...p,
      machines: p.machines.map((m) => ({ ...m, price: { centAmount: 45000, currencyCode: 'CAD' }, was: { centAmount: 50000, currencyCode: 'CAD' }, save: { centAmount: 5000, currencyCode: 'CAD' } })),
    })),
  });

  it('US to CA re-adds the bundle at the CAD price, once, with its parts', async () => {
    const { bag } = await bagWithBundle();
    ct.view = canadianView(false);
    const oldCart = ct.carts.get(bag.cartId as string) as unknown as Parameters<typeof rebuildCart>[1];
    const result = await rebuildCart(bag, oldCart, CA);
    expect(result.dropped).toEqual([]);
    const newCart = ct.carts.get(result.session.cartId as string) as { lineItems: { key?: string; externalPrice?: { currencyCode: string; centAmount: number }; custom?: { fields: Record<string, unknown> } }[] };
    const parents = newCart.lineItems.filter((l) => l.key?.startsWith('bundle-'));
    expect(parents).toHaveLength(1);
    expect(parents[0].externalPrice).toEqual({ currencyCode: 'CAD', centAmount: 45000 });
    expect(newCart.lineItems).toHaveLength(4); // the parent and its three parts; the parts are not re-added on their own
  });

  it('a preset with no price in CA comes back as a dropped line, and no part is left behind', async () => {
    const { bag } = await bagWithBundle();
    ct.view = canadianView(true);
    const oldCart = ct.carts.get(bag.cartId as string) as unknown as Parameters<typeof rebuildCart>[1];
    const result = await rebuildCart(bag, oldCart, CA);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]).toMatchObject({ sku: BUNDLE_SKU, reason: 'no-price' });
    const newCart = ct.carts.get(result.session.cartId as string) as { lineItems: unknown[] };
    expect(newCart.lineItems).toEqual([]);
  });
});

describe('a collected bundle and a store change (V-10, D6)', () => {
  it('a collected bundle moves with every part when the shopper changes store', async () => {
    const { bag, parent, parts } = await bagWithBundle();
    await switchFulfilment(bag, MARKET, parent.id, { fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' });
    ct.updates.length = 0;
    await changeCollectionStore(bag, MARKET, 'mcf-store-brooklyn');
    const moved = ct.updates[0].actions.filter((a) => a.action === 'setLineItemSupplyChannel');
    expect(moved.map((a) => a.lineItemId).sort()).toEqual([parent.id, ...parts.map((p) => p.id)].sort());
    expect(moved.every((a) => (a.supplyChannel as { id: string }).id === 'ch-bk')).toBe(true);
  });
});

