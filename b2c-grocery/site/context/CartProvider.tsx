'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { useCart, useCartMutations, type AddItemOptions } from '@/hooks/useCart';
import { ApiError } from '@/lib/fetcher';
import type { Cart } from '@/lib/types';

type CartContextValue = {
  /** `null` when there is no cart (or it has not loaded and was not seeded). */
  cart: Cart | null;
  isLoading: boolean;
  /** Distinct lines in the bag (what the header shows). */
  itemCount: number;
  addItem: (sku: string, quantity: number, options?: AddItemOptions) => Promise<Cart | null>;
  setQuantity: (lineId: string, quantity: number) => Promise<Cart | null>;
  removeLine: (lineId: string) => Promise<Cart | null>;
  /** Adds, then shows the "Added to your bag" toast (or the failure message). Resolves `true` on success; never throws. */
  addItemWithToast: (sku: string, quantity: number, options?: AddItemOptions) => Promise<boolean>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCartContext must be used inside <CartProvider>');
  return value;
}

const availableOf = (error: ApiError): number | undefined => {
  const data = error.data;
  const available = typeof data === 'object' && data !== null ? (data as { available?: unknown }).available : undefined;
  return typeof available === 'number' ? available : undefined;
};

/** Sits inside `ToastProvider` and `NextIntlClientProvider`, below `SWRProvider` (see the locale layout). */
export function CartProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('cart');
  const toast = useToast();
  const { cart, isLoading } = useCart();
  const { addItem, setQuantity, removeLine } = useCartMutations();

  const addItemWithToast = useCallback(
    async (sku: string, quantity: number, options?: AddItemOptions): Promise<boolean> => {
      try {
        await addItem(sku, quantity, options);
        toast.show({ message: t('added'), actionLabel: t('viewBag'), href: '/cart' });
        return true;
      } catch (e) {
        const available = e instanceof ApiError && e.status === 409 ? availableOf(e) : undefined;
        toast.show({
          message: available === undefined ? t('addFailed') : available > 0 ? t('insufficientStock', { available }) : t('outOfStock'),
        });
        return false;
      }
    },
    [addItem, t, toast],
  );

  const value = useMemo<CartContextValue>(
    () => ({ cart, isLoading, itemCount: cart?.itemCount ?? 0, addItem, setQuantity, removeLine, addItemWithToast }),
    [cart, isLoading, addItem, setQuantity, removeLine, addItemWithToast],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
