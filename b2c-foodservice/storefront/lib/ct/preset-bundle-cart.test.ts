// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildPresetBundleActions, buildRaiseBundleActions } from '@/lib/ct/preset-bundle-cart';

const plan = {
  parentSku: '998674532', key: 'bundle-1', quantity: 1, presetIndex: 0, discount: 0.1,
  wasCents: 38795, priceCents: 34916, currency: 'USD', fulfilment: 'delivery' as const,
  machineSku: 'MCF-MAC-VERTUO-BLA-M', podSkus: ['MCF-GFT-STARTER', 'MCF-GFT-DISCOVERY'],
};

describe('buildPresetBundleActions (V-09)', () => {
  const actions = buildPresetBundleActions(plan) as { action: string; sku: string; key?: string; quantity: number; externalPrice: { centAmount: number }; custom: { fields: Record<string, unknown> } }[];

  it('the parent carries the key, the bundle price and the preset fields', () => {
    const [parent] = actions;
    expect(parent).toMatchObject({
      action: 'addLineItem', sku: '998674532', key: 'bundle-1', quantity: 1,
      externalPrice: { currencyCode: 'USD', centAmount: 34916 },
    });
    expect(parent.custom.fields).toEqual({
      fulfilment: 'delivery', brand: 'malva-coffee', bundlePreset: '0', bundleDiscount: 0.1, bundleWasCents: 38795, bundleMachineSku: 'MCF-MAC-VERTUO-BLA-M',
    });
  });

  it('the machine and every pod are $0 children linked by parentId, in order', () => {
    const children = actions.slice(1);
    expect(children.map((c) => c.sku)).toEqual(['MCF-MAC-VERTUO-BLA-M', 'MCF-GFT-STARTER', 'MCF-GFT-DISCOVERY']);
    for (const child of children) {
      expect(child.externalPrice.centAmount).toBe(0);
      expect(child.quantity).toBe(1);
      expect(child.custom.fields).toEqual({ fulfilment: 'delivery', brand: 'malva-coffee', parentId: 'bundle-1' });
    }
  });

  it('a collect bundle puts the store channel on every line', () => {
    const collect = buildPresetBundleActions({ ...plan, fulfilment: 'collect', storeChannelId: 'store-1' }) as { supplyChannel?: unknown }[];
    expect(collect.every((a) => JSON.stringify(a.supplyChannel) === JSON.stringify({ typeId: 'channel', id: 'store-1' }))).toBe(true);
  });
});

describe('buildRaiseBundleActions (V-09)', () => {
  it('raises the parent and every child by the same amount in one list', () => {
    expect(buildRaiseBundleActions({ id: 'P', quantity: 1 }, [{ id: 'A', quantity: 1 }, { id: 'B', quantity: 1 }], 2)).toEqual([
      { action: 'changeLineItemQuantity', lineItemId: 'P', quantity: 3 },
      { action: 'changeLineItemQuantity', lineItemId: 'A', quantity: 3 },
      { action: 'changeLineItemQuantity', lineItemId: 'B', quantity: 3 },
    ]);
  });
});
