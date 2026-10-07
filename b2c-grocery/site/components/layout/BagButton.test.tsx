import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cartLine, jsonResponse, makeCart, renderWithCart } from '@/test/cart';
import { BagButton } from './BagButton';

afterEach(() => vi.unstubAllGlobals());

describe('BagButton', () => {
  it('Bag count: empty bag reads "Bag"', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ cart: null })));
    renderWithCart(<BagButton />, { cart: null });
    expect(screen.getByRole('link', { name: 'Bag' })).toHaveAttribute('href', expect.stringContaining('/cart'));
  });

  it('Bag count: two distinct lines read "Bag · 2" (units do not count)', () => {
    const cart = makeCart({ lines: [cartLine({ id: 'a', quantity: 5 }), cartLine({ id: 'b', sku: 'EGGS' })] });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ cart })));
    renderWithCart(<BagButton />, { cart });
    expect(screen.getByRole('link', { name: 'Bag · 2' })).toBeInTheDocument();
  });

  it('Returning customer hydration: the seeded cart is on the first paint (no fetch needed to render it)', () => {
    const cart = makeCart({ lines: [cartLine()] });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => undefined)));
    renderWithCart(<BagButton />, { cart });
    expect(screen.getByRole('link', { name: 'Bag · 1' })).toBeInTheDocument();
  });

  it('German label', () => {
    const cart = makeCart();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ cart })));
    renderWithCart(<BagButton />, { cart, locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Warenkorb · 1' })).toBeInTheDocument();
  });
});
