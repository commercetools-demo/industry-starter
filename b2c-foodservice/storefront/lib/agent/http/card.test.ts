import { describe, expect, it } from 'vitest';
import { FakeBackend, product, session } from '../testing';
import { SHOPPING_CONFIG } from '../deployment';
import { cardProduct } from '../shopping/card-serialization';
import { cardAdd, cardProductDetail, isProductId } from './card';

describe('card routes', () => {
  it('Card add applies the cap and the options hold but not provenance', async () => {
    const backend = new FakeBackend([product('SKU-1')]);
    // not in provenance: still added
    const ok = await cardAdd({
      backend,
      config: SHOPPING_CONFIG,
      session: session(),
      productId: 'SKU-1',
      quantity: 2,
    });
    expect(ok.ok).toBe(true);
    expect(backend.cart.items[0]?.quantity).toBe(2);
    // the per-item cap applies
    const capped = await cardAdd({
      backend,
      config: SHOPPING_CONFIG,
      session: session(),
      productId: 'SKU-1',
      quantity: 9999,
    });
    expect(capped.ok).toBe(true);
    expect(backend.cart.items[0]?.quantity).toBeLessThanOrEqual(SHOPPING_CONFIG.maxQuantityPerItem);
  });

  it('A family in the session state is held for options', async () => {
    const family = product('fam:x', { options: { Size: ['S', 'M'] } });
    const backend = new FakeBackend([family]);
    const state = { seenProducts: new Map([[family.productId, family]]) };
    const result = await cardAdd({
      backend,
      config: SHOPPING_CONFIG,
      session: session(),
      productId: 'fam:x',
      quantity: 1,
      state,
    });
    expect(result.ok).toBe(false);
    expect(backend.cart.items).toHaveLength(0);
  });

  it('Card detail equals the streamed card payload', async () => {
    const p = product('SKU-2');
    const backend = new FakeBackend([p]);
    const detail = await cardProductDetail(backend, session(), 'SKU-2');
    expect(detail?.product).toEqual(cardProduct(p));
    expect(await cardProductDetail(backend, session(), 'nope')).toBeNull();
  });

  it('Validates the id shape', () => {
    expect(isProductId('MCF-A-1')).toBe(true);
    expect(isProductId('fam:abc')).toBe(true);
    expect(isProductId('a b')).toBe(false);
    expect(isProductId(5)).toBe(false);
  });
});
