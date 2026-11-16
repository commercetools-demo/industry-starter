// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BundleView } from '@/lib/types';

const ct = vi.hoisted(() => ({
  carts: new Map<string, Record<string, unknown>>(),
  updates: [] as { id: string; actions: Record<string, unknown>[] }[],
  n: 0,
  view: null as BundleView | null,
}));

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
            ct.updates.push({ id: ID, actions: body.actions });
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
  getInventoryDetail: async (skus: string[]) => Object.fromEntries(skus.map((sku) => [sku, { online: 100, stores: {} }])),
  getStoreStock: async () => 100,
}));
vi.mock('@/lib/ct/channels', () => ({ getBrandChannelId: async () => undefined, getStoresForCountry: async () => [] }));
vi.mock('@/lib/ct/cart-enrich', async () => ({ getCartEnrichment: async () => (await import('@/lib/mappers/cart')).EMPTY_ENRICHMENT }));
vi.mock('@/lib/ct/order-type', () => ({ orderTypeCartActions: async () => [], withOrderType: async (d: unknown) => d }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));

import { LineRejected, addLine, addPresetBundle } from '@/lib/ct/cart';
import { BUNDLE_SKU, componentProducts, inventoryFor } from '@/test/preset-bundle';
import { BUNDLE_CONFIG_VALUE } from '@/test/preset-bundle';
import { mapBundleView, parseBundleConfig } from '@/lib/mappers/preset-bundle';
import type { Session } from '@/lib/session';

const MARKET = { country: 'US', currency: 'USD', locale: 'en-US' };
const session = () => ({ anonymousId: 'anon-1' }) as unknown as Session;

beforeEach(() => {
  ct.carts.clear();
  ct.updates.length = 0;
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
