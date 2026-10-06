import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { CartProvider } from '@/context/CartProvider';
import type { Cart, CartLine } from '@/lib/types';
import { renderWithProviders } from './utils';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });

export function cartLine(over: Partial<CartLine> = {}): CartLine {
  return {
    id: 'line-1',
    productId: 'p-1',
    sku: 'MILK-1L',
    name: 'Whole milk 1 L',
    slug: 'whole-milk',
    quantity: 1,
    unitPrice: usd(199),
    total: usd(199),
    increment: { value: 1, unit: 'l', label: '1 L' },
    approximateWeight: false,
    substitutionPreference: 'none',
    inStock: true,
    availableQuantity: 10,
    ...over,
  };
}

export function makeCart(over: Partial<Cart> = {}): Cart {
  const lines = over.lines ?? [cartLine()];
  const subtotal = usd(lines.reduce((sum, l) => sum + l.total.centAmount, 0));
  return {
    id: 'cart-1',
    version: 1,
    currencyCode: 'USD',
    lines,
    itemCount: lines.length,
    subtotal,
    total: subtotal,
    isProvisional: false,
    ...over,
  };
}

/** Response factory: every call returns a fresh Response (a body can be read once). */
export const jsonResponse = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

/**
 * Renders inside the real providers (intl, toast, SWR) plus `CartProvider`, with `cart` seeded as the SWR fallback
 * (what the locale layout does on the server). `fetch` is stubbed by the caller.
 */
export function renderWithCart(ui: ReactElement, { cart = null, locale = 'en-US' }: { cart?: Cart | null; locale?: 'en-US' | 'de-DE' } = {}) {
  return renderWithProviders(
    <SWRConfig value={{ fallback: { cart } }}>
      <CartProvider>{ui}</CartProvider>
    </SWRConfig>,
    { locale },
  );
}
