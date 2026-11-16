// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { detectPriceChanges, mapCart, mapCartSummary } from '@/lib/mappers/cart';
import { ctCart, ctLine, enrichment, usd, vt } from '@/test/cart';

const ctx = { locale: 'en-US', t: vt, collection: true } as const;
const KEY = 'bundle-11111111-2222-4333-8444-555555555555';
const MACHINE = 'MCF-MAC-VERTUO-BLA-M';
const PODS = ['MCF-GFT-STARTER', 'MCF-GFT-DISCOVERY'];

/** A bundle row: the parent at the bundle price, the machine and two pods at $0, all linked by `parentId`. */
function bundle(quantity = 1, parentId = KEY) {
  const parent = { ...ctLine({
    id: 'P', sku: '998674532', productId: 'bundle-product', quantity, cents: 34916,
    custom: { bundlePreset: '0', bundleMachineSku: MACHINE, bundleDiscount: 0.1, bundleWasCents: 38795, brand: 'malva-coffee' },
  }), key: parentId };
  const part = (id: string, sku: string) => ctLine({ id, sku, quantity, cents: 0, custom: { parentId, brand: 'malva-coffee' } });
  return { parent, parts: [part('M', MACHINE), part('S1', PODS[0]), part('S2', PODS[1])] };
}

describe('preset bundle in the bag (V-12)', () => {
  it('a bundle and one pod line give two rows, and the count is the bundle quantity plus the pod quantity', () => {
    const { parent, parts } = bundle(1);
    const pod = ctLine({ id: 'X', sku: 'MCF-ACC-CAROUSEL-BLA', quantity: 1, cents: 2495, custom: { brand: 'malva-coffee' } });
    const cart = ctCart({ lines: [parent, ...parts, pod] });
    const view = mapCart(cart, enrichment(), ctx);
    expect(view.lines.map((l) => l.id)).toEqual(['P', 'X']);
    expect(view.count).toBe(2);
    expect(mapCartSummary(cart).count).toBe(2);
    expect(mapCartSummary(cart).lines.map((l) => l.id)).toEqual(['P', 'X']);
  });

  it('a bundle of two counts as two, not as four lines', () => {
    const { parent, parts } = bundle(2);
    const cart = ctCart({ lines: [parent, ...parts] });
    expect(mapCart(cart, enrichment(), ctx).count).toBe(2);
  });

  it('the parts are in no group: a group lists only the parent', () => {
    const { parent, parts } = bundle(1);
    const view = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment(), ctx);
    const grouped = view.groups.flatMap((g) => g.lineIds);
    expect(grouped).toEqual(['P']);
  });

  it('the bundle block names the preset and lists the machine first, then the pods', () => {
    const { parent, parts } = bundle(1);
    const view = mapCart(ctCart({ lines: [parent, parts[1], parts[0], parts[2]] }), enrichment({
      bundles: { 'bundle-product': { 0: { name: 'Vertuo bundle', discountPercent: 10 } } },
    }), ctx);
    const row = view.lines[0];
    expect(row.bundle).toMatchObject({ presetName: 'Vertuo bundle', discountPercent: 10 });
    expect(row.bundle?.items.map((i) => [i.role, i.sku])).toEqual([
      ['machine', MACHINE], ['item', PODS[0]], ['item', PODS[1]],
    ]);
    expect(row.imageUrl).toBe(`https://img.example.com/${MACHINE}.jpg`);
  });

  it('a bundle without a readable config is named "Bundle" and keeps its discount', () => {
    const { parent, parts } = bundle(1);
    const row = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment(), ctx).lines[0];
    expect(row.bundle).toMatchObject({ presetName: 'Bundle', discountPercent: 10 });
  });

  it('the was price comes from bundleWasCents and is struck through', () => {
    const { parent, parts } = bundle(1);
    const row = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment(), ctx).lines[0];
    expect(row.unitPrice).toEqual(usd(34916));
    expect(row.oldUnitPrice).toEqual(usd(38795));
    expect(row.bundle?.wasUnitPrice).toEqual(usd(38795));
  });

  it('maxQuantity is the smallest of the parts and the cart maximum', () => {
    const { parent, parts } = bundle(1);
    const inventory = {
      [MACHINE]: { online: 3, stores: {} },
      [PODS[0]]: { online: 2, stores: {} },
      [PODS[1]]: { online: 50, stores: {} },
    };
    const row = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment({ inventory }), ctx).lines[0];
    expect(row.maxQuantity).toBe(2);
  });

  it('a part with no stock puts its notice on the bundle row', () => {
    const { parent, parts } = bundle(1);
    const inventory = { [MACHINE]: { online: 10, stores: {} }, [PODS[0]]: { online: 0, stores: {} }, [PODS[1]]: { online: 10, stores: {} } };
    const row = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment({ inventory }), ctx).lines[0];
    expect(row.notices.map((n) => n.kind)).toContain('out-of-stock');
  });

  it('the bundle SKU has no stock of its own: parts in stock give no out-of-stock notice on the row', () => {
    const { parent, parts } = bundle(1);
    const inventory = { [MACHINE]: { online: 10, stores: {} }, [PODS[0]]: { online: 10, stores: {} }, [PODS[1]]: { online: 10, stores: {} } };
    const row = mapCart(ctCart({ lines: [parent, ...parts] }), enrichment({ inventory }), ctx).lines[0];
    expect(row.notices).toEqual([]);
  });

  it('an externally priced line is never reported as a price change (the catalogue price does not apply)', () => {
    const external = { ...ctLine({ id: 'E', sku: 'SKU-E', productId: 'pe', quantity: 1, cents: 34916 }), priceMode: 'ExternalPrice' };
    const normal = ctLine({ id: 'N', sku: 'SKU-N', productId: 'pn', quantity: 1, cents: 1000 });
    const products = {
      pe: { variants: { 'SKU-E': { currentPrice: usd(40000) } } },
      pn: { variants: { 'SKU-N': { currentPrice: usd(1500) } } },
    } as unknown as Parameters<typeof detectPriceChanges>[1]['products'];
    const changes = detectPriceChanges(ctCart({ lines: [external, normal] }), { products });
    expect(Object.keys(changes)).toEqual(['N']);
  });
});

