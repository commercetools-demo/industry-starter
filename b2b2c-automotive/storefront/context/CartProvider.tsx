// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCart, type UseCart } from '@/hooks/useCart';
import type { Cart } from '@/lib/types';

const CartContext = createContext<UseCart | null>(null);

/** Provides the cart and its actions to the cart page. `initialCart` is the server read of the first paint (null: a known empty cart). */
export function CartProvider({ initialCart, children }: { initialCart?: Cart | null; children: ReactNode }) {
  const value = useCart(initialCart);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Throws outside `CartProvider`. */
export function useCartContext(): UseCart {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCartContext must be used inside CartProvider');
  return value;
}
