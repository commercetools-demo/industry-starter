// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { addRxLines, clearCart } from './cart-fixtures';

const line = (n: number) => ({ sku: 'MED-atorvastatin-20-mg', lineRef: `RX-1-${n}`, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });

describe('fixture cart', () => {
  it('a new cart after an order has a different version, so its idempotency key (cart id + version) is new', async () => {
    const first = await addRxLines('fixture-version-test', 'RX-1', [line(1)]);
    clearCart('fixture-version-test');
    const second = await addRxLines('fixture-version-test', 'RX-1', [line(1)]);
    expect(second.cart.id).toBe(first.cart.id);
    expect(second.cart.version).not.toBe(first.cart.version);
  });
});
