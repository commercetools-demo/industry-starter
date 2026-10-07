'use client';

import { createContext, useCallback, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { CartError, useCart, useCartMutations, type AddLineArgs, type CartMutations } from '@/hooks/useCart';
import type { BlockedAdd, Cart } from '@/lib/types';

export interface CartContextValue extends CartMutations {
  cart: Cart | null;
  isLoading: boolean;
  itemCount: number;
  /**
   * Adds a line and shows the toast "{name} added to your bundle" with the action "View bundle". Never throws: a refusal calls
   * `onBlocked` (cards show the reason) or an error toast, and the result is false.
   */
  addLineWithToast: (args: AddLineArgs & { name?: string }) => Promise<boolean>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCartContext must be used inside <CartProvider>');
  return value;
}

/** Sits inside NextIntlClientProvider > SWRConfig > ToastProvider (workstream M). */
export function CartProvider({ children, onBlocked }: { children: ReactNode; onBlocked?: (blocked: BlockedAdd, args: AddLineArgs) => void }): ReactElement {
  const t = useTranslations('bundle');
  const toast = useToast();
  const { cart, isLoading, itemCount } = useCart();
  const mutations = useCartMutations();

  const addLineWithToast = useCallback(
    async ({ name, ...args }: AddLineArgs & { name?: string }): Promise<boolean> => {
      try {
        const updated = await mutations.addLine(args);
        const shown = name ?? updated?.lines.find((line) => line.offerKey === args.offerKey && line.kind !== 'fee')?.name ?? '';
        toast.show({ message: t('toast.added', { name: shown }), actionLabel: t('toast.view'), href: '/bundle' });
        return true;
      } catch (error) {
        const blocked = error instanceof CartError ? error.blocked : undefined;
        if (blocked && onBlocked) onBlocked(blocked, args);
        else toast.show({ message: t('error.generic'), tone: 'error' });
        return false;
      }
    },
    [mutations, onBlocked, t, toast],
  );

  const value = useMemo<CartContextValue>(
    () => ({ ...mutations, cart, isLoading, itemCount, addLineWithToast }),
    [mutations, cart, isLoading, itemCount, addLineWithToast],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
