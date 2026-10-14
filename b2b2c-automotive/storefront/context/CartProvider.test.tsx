// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { cart } from '@/test/cart-view-model';
import { CartProvider, useCartContext } from './CartProvider';

function Count() {
  const { itemCount, cart: current } = useCartContext();
  return <p>{`count ${itemCount} lines ${current?.lines.length ?? 0}`}</p>;
}

describe('context/CartProvider', () => {
  it('throws outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Count />)).toThrow('useCartContext must be used inside CartProvider');
    spy.mockRestore();
  });
  it('count reads 3 for quantities 2 and 1', () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <CartProvider initialCart={cart()}>
          <Count />
        </CartProvider>
      </SWRConfig>,
    );
    expect(screen.getByText('count 3 lines 2')).toBeInTheDocument();
  });
  it('a null initial cart is a known empty cart', () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <CartProvider initialCart={null}>
          <Count />
        </CartProvider>
      </SWRConfig>,
    );
    expect(screen.getByText('count 0 lines 0')).toBeInTheDocument();
  });
});
