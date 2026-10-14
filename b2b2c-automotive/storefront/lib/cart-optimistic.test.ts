// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { cart, eur, line } from '@/test/cart-view-model';
import { applyQuantity, applyRemoval } from './cart-optimistic';

describe('optimistic cart', () => {
  it('a bigger quantity raises line total, item count, subtotal and total', () => {
    const next = applyQuantity(cart(), 'li-1', 3);
    expect(next.lines[0]).toMatchObject({ quantity: 3 });
    expect(next.lines[0].total.centAmount).toBe(9200 + 4600);
    expect(next.itemCount).toBe(4);
    expect(next.totals.subtotal.centAmount).toBe(11000 + 5000);
    expect(next.totals.total.centAmount).toBe(10150 + 4600);
  });
  it('the quantity never goes below one', () => {
    expect(applyQuantity(cart(), 'li-2', 0).lines[1].quantity).toBe(1);
  });
  it('removal drops the line and its share of the totals', () => {
    const next = applyRemoval(cart(), 'li-2');
    expect(next.lines.map((l) => l.id)).toEqual(['li-1']);
    expect(next.itemCount).toBe(2);
    expect(next.totals.total.centAmount).toBe(10150 - 1000);
  });
  it('a bundle line moves its locked component lines with it and counts bundles, not components (W-11)', () => {
    const base = cart();
    const withBundle = {
      ...base,
      lines: [
        ...base.lines,
        line({ id: 'p', sku: 'BND-1', quantity: 2, unitPrice: eur(7578), listUnitPrice: null, total: eur(15156) }),
        line({ id: 'k1', sku: 'SK-1', quantity: 4, unitPrice: eur(0), listUnitPrice: null, total: eur(0), parentLineItemId: 'p' }),
        line({ id: 'k2', sku: 'SK-2', quantity: 2, unitPrice: eur(0), listUnitPrice: null, total: eur(0), parentLineItemId: 'p' }),
      ],
    };
    const more = applyQuantity(withBundle, 'p', 3);
    expect(more.lines.filter((l) => l.parentLineItemId === 'p').map((l) => l.quantity)).toEqual([6, 3]);
    expect(more.itemCount).toBe(3 + 3); // 3 units of parts plus 3 bundles
    const gone = applyRemoval(withBundle, 'p');
    expect(gone.lines.map((l) => l.id)).toEqual(['li-1', 'li-2']);
    expect(gone.itemCount).toBe(3);
  });
  it('an unknown line changes nothing', () => {
    const before = cart();
    expect(applyQuantity(before, 'zzz', 5)).toBe(before);
  });
});
