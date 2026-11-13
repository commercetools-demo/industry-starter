import { describe, expect, it } from 'vitest';
import { brandSections } from '@/lib/cart/brand-sections';
import { viewCart, viewLine } from '@/test/cart';

const coffee = (id: string, cents: number) => viewLine({ id, unitPrice: { centAmount: cents, currencyCode: 'USD' } });
const drinks = (id: string, cents: number) => viewLine({ id, brand: 'malva-drinks', unitPrice: { centAmount: cents, currencyCode: 'USD' } });

describe('brandSections', () => {
  it('one section per brand with lines, the current brand first, with a brand subtotal', () => {
    const cart = viewCart([coffee('a', 1000), drinks('b', 250), drinks('c', 300)]);
    const onDrinks = brandSections(cart, 'malva-drinks');
    expect(onDrinks.map((s) => s.brand)).toEqual(['malva-drinks', 'malva-coffee']);
    expect(onDrinks[0]?.subtotal.centAmount).toBe(550);
    expect(onDrinks[0]?.lines.map((l) => l.id)).toEqual(['b', 'c']);
    expect(brandSections(cart, 'malva-coffee').map((s) => s.brand)).toEqual(['malva-coffee', 'malva-drinks']);
  });

  it('a cart with one brand has one section and no empty section', () => {
    const cart = viewCart([drinks('b', 250)]);
    expect(brandSections(cart, 'malva-coffee').map((s) => s.brand)).toEqual(['malva-drinks']);
    expect(brandSections(viewCart([]), 'malva-coffee')).toEqual([]);
  });

  it('keeps the fulfilment clusters, reduced to the brand lines (a delivery cluster of two brands is in both)', () => {
    const cart = viewCart([coffee('a', 1000), drinks('b', 250)]);
    expect(cart.groups).toHaveLength(1);
    const [first, second] = brandSections(cart, 'malva-coffee');
    expect(first?.groups.map((g) => [g.key, g.lineIds])).toEqual([['delivery', ['a']]]);
    expect(second?.groups.map((g) => [g.key, g.lineIds])).toEqual([['delivery', ['b']]]);
  });
});
