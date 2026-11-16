// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ct/client', () => ({ apiRoot: {} }));
vi.mock('@/lib/ct/cart', () => ({
  buildAddLineAction: () => ({ action: 'addLineItem' }), getCartView: async () => null, getOwnedCartForRebuild: async () => null,
  ownsCart: () => true, rebuildCart: async () => null,
}));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: async () => [] }));
vi.mock('@/lib/ct/order-type', () => ({ withOrderType: async (d: unknown) => d }));
vi.mock('@/lib/ct/public-cache', () => ({ cachedPublic: (_k: string, _p: string[], fn: unknown) => fn }));

import { bundleLineDraft, lineDraft, sameLine, selectGroupLines } from '@/lib/ct/checkout';
import { ctCart, ctLine } from '@/test/cart';

const KEY = 'bundle-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const parent = { ...ctLine({ id: 'P', sku: '998674532', productId: 'bp', quantity: 1, cents: 34916, custom: { bundlePreset: '0', bundleMachineSku: 'MCF-MAC-VERTUO-BLA-M', bundleDiscount: 0.1, bundleWasCents: 38795, brand: 'malva-coffee' } }), key: KEY };
const part = (id: string, sku: string, parentId = KEY) => ctLine({ id, sku, quantity: 1, cents: 0, custom: { parentId, brand: 'malva-coffee' } });
const machine = part('M', 'MCF-MAC-VERTUO-BLA-M');
const pod = part('S', 'MCF-GFT-STARTER');
const ownSameSku = ctLine({ id: 'OWN', sku: 'MCF-GFT-STARTER', quantity: 1, cents: 17900, custom: { brand: 'malva-coffee' } });

describe('checkout clone of a bundle (V-15)', () => {
  it('a group that lists only the parent clones the parent and every part', () => {
    const raw = ctCart({ lines: [parent, machine, pod, ownSameSku] });
    expect(selectGroupLines(raw, ['P']).map((l) => l.id)).toEqual(['P', 'M', 'S']);
    expect(selectGroupLines(raw, ['OWN']).map((l) => l.id)).toEqual(['OWN']);
  });

  it('the clone of a bundle keeps its key, its external price and every custom field', () => {
    const draft = bundleLineDraft(parent);
    expect(draft).toMatchObject({
      sku: '998674532', quantity: 1, key: KEY, externalPrice: { currencyCode: 'USD', centAmount: 34916 },
      custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' } },
    });
    expect(draft.custom?.fields).toEqual({
      fulfilment: 'delivery', brand: 'malva-coffee', bundlePreset: '0', bundleDiscount: 0.1, bundleWasCents: 38795, bundleMachineSku: 'MCF-MAC-VERTUO-BLA-M',
    });
    const childDraft = bundleLineDraft(pod);
    expect(childDraft.custom?.fields?.parentId).toBe(KEY);
    expect(childDraft.externalPrice?.centAmount).toBe(0);
  });

  it('a normal line is cloned as before', () => {
    // The action builder is stubbed in this file; the normal path is covered by cart.test.ts.
    expect(lineDraft(ownSameSku)).not.toHaveProperty('key');
  });

  it('sameLine: a part never matches the shopper\'s own line of the same SKU, nor a part of another bundle', () => {
    expect(sameLine(parent, parent)).toBe(true);
    expect(sameLine(pod, pod)).toBe(true);
    expect(sameLine(pod, ownSameSku)).toBe(false);
    expect(sameLine(pod, part('S2', 'MCF-GFT-STARTER', 'bundle-other'))).toBe(false);
  });
});
