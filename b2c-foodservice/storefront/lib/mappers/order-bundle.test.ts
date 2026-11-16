// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it, vi } from 'vitest';
import { returnableUnits, mapOrder } from '@/lib/mappers/order';

vi.mock('@/lib/ct/cart', () => ({ LineRejected: class extends Error {}, addLine: async () => null, addPresetBundle: async () => null, getCartForSession: async () => null }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: async () => ({}) }));

import { planReorder } from '@/lib/ct/reorder';
import { ctLine, ctOrder } from '@/test/orders';
import type { LineItem, Order } from '@commercetools/platform-sdk';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const KEY = 'bundle-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const MACHINE = 'MCF-MAC-VERTUO-BLA-M';

/** A placed order with one bundle (parent and three parts) and one normal line. */
function orderWithBundle(): Order {
  const parent = { ...ctLine('P', {
    key: KEY, variant: { id: 1, sku: '998674532', images: [] }, quantity: 1,
    price: { id: 'pr', value: { centAmount: 34916, currencyCode: 'USD' } }, totalPrice: { centAmount: 34916, currencyCode: 'USD' },
    custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'delivery', brand: 'malva-coffee', bundlePreset: '0', bundleDiscount: 0.1, bundleWasCents: 38795, bundleMachineSku: MACHINE } },
  }) } as unknown as LineItem;
  const part = (id: string, sku: string) => ({ ...ctLine(id, {
    variant: { id: 1, sku, images: [{ url: `https://img.example.com/${sku}.jpg`, dimensions: { w: 1, h: 1 } }] }, quantity: 1,
    price: { id: 'pr', value: { centAmount: 0, currencyCode: 'USD' } }, totalPrice: { centAmount: 0, currencyCode: 'USD' },
    custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'delivery', brand: 'malva-coffee', parentId: KEY } },
  }) }) as unknown as LineItem;
  const pod = ctLine('N', { quantity: 1, price: { id: 'pr', value: { centAmount: 2495, currencyCode: 'USD' } }, totalPrice: { centAmount: 2495, currencyCode: 'USD' } });
  return ctOrder({ lineItems: [parent, part('M', MACHINE), part('S', 'MCF-GFT-STARTER'), part('D', 'MCF-GFT-DISCOVERY'), pod] });
}

describe('preset bundle in orders (V-17)', () => {
  it('the confirmation shows one bundle row with its parts, machine first', () => {
    const view = mapOrder(orderWithBundle(), { locale: 'en-US', now: NOW });
    expect(view.lines.map((l) => l.id)).toEqual(['P', 'N']);
    const row = view.lines[0];
    expect(row.bundle?.items.map((i) => [i.role, i.sku])).toEqual([
      ['machine', MACHINE], ['item', 'MCF-GFT-STARTER'], ['item', 'MCF-GFT-DISCOVERY'],
    ]);
    expect(row.imageUrl).toBe(`https://img.example.com/${MACHINE}.jpg`);
    expect(row.unitCents).toBe(34916);
    expect(row.bundle?.discountPercent).toBe(10);
  });

  it('returnable lists the bundle row, not its parts', () => {
    const units = returnableUnits(orderWithBundle());
    expect(Object.keys(units).sort()).toEqual(['N', 'P']);
    expect(units.P).toBe(1);
  });

  it('buy again plans the bundle once, with its preset, and no parts', () => {
    const plan = planReorder(orderWithBundle(), { locale: 'en-US', collection: true });
    expect(plan.map((p) => p.sku)).toEqual(['998674532', 'SKU-N']);
    const bundle = plan.find((p) => p.sku === '998674532');
    expect(bundle).toMatchObject({ fulfilment: 'delivery', bundle: { preset: 0, machineSku: MACHINE } });
    expect(plan.some((p) => p.sku === 'MCF-GFT-STARTER' || p.sku === MACHINE || p.sku === 'MCF-GFT-DISCOVERY')).toBe(false);
  });
});
