// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it, vi } from 'vitest';
import type { LineItem } from '@commercetools/platform-sdk';
import { ctLine, ctOrder } from '@/test/orders';

vi.mock('@/lib/ct/client', () => ({ apiRoot: {} }));
import { withBundleParts } from '@/lib/ct/orders';

const KEY = 'bundle-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const parent = { ...ctLine('P', { key: KEY, quantity: 2, custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'delivery', brand: 'malva-coffee' } } }) } as unknown as LineItem;
const part = (id: string) => ({ ...ctLine(id, { quantity: 2, custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'delivery', parentId: KEY } } }) }) as unknown as LineItem;
const order = ctOrder({ lineItems: [parent, part('M'), part('S'), ctLine('N', { quantity: 1 })] });

describe('returns of a preset bundle (V-17)', () => {
  it('returning the bundle row returns every part at the same quantity', () => {
    const items = withBundleParts(order, [{ lineId: 'P', quantity: 1 }]);
    expect(items.map((i) => [i.lineId, i.quantity])).toEqual([['P', 1], ['M', 1], ['S', 1]]);
  });

  it('a normal line is returned as before', () => {
    expect(withBundleParts(order, [{ lineId: 'N', quantity: 1, reason: 'x' }])).toEqual([{ lineId: 'N', quantity: 1, reason: 'x' }]);
  });
});
