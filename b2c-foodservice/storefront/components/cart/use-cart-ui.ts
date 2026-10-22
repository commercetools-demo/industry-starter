'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/hooks/fetcher';
import { useCartMutations } from '@/hooks/useCartMutations';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { formatInterval } from '@/lib/product/interval';
import type { Cart, CartLine, Money, RecurrencePolicyView } from '@/lib/types';
import { formatMoney, marketForLocale } from '@/lib/utils';

/** Money in the page locale. Money is always integer minor units from the engine. */
export function useMoney(): (m: Money) => string {
  const locale = useLocale();
  return useCallback((m: Money) => formatMoney(m.centAmount, m.currencyCode, locale), [locale]);
}

/** "Every 2 weeks" for a recurrence schedule (workstream H's `formatInterval`). */
export function useIntervalLabel(): (schedule: RecurrencePolicyView['schedule']) => string {
  const t = useTranslations('pdp');
  return useCallback(
    (schedule) => formatInterval(schedule, t as unknown as Parameters<typeof formatInterval>[1]),
    [t],
  );
}

/** Collection in store is offered in this market (US only, D-035). In Canada no Collect chip, cluster or badge is rendered. */
export function useCollectionOffered(): boolean {
  return marketForLocale(useLocale()).collection;
}

/** The store of a collect line, with a safe fallback label. */
export const storeName = (line: Pick<CartLine, 'store'>): string => line.store?.name ?? '';

/** After a line is removed focus moves to the next remove button, or to the empty-state button. */
export function focusAfterRemove(container: HTMLElement | null, index: number): void {
  if (!container) return;
  requestAnimationFrame(() => {
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-line-remove]'));
    const next = buttons[Math.min(index, buttons.length - 1)] ?? container.querySelector<HTMLElement>('[data-empty-cta]');
    next?.focus();
  });
}

/**
 * Cart writes plus the shopper-facing feedback shared by the drawer and the page: one `message` (conflict, stock limit,
 * generic), the quantity floor, and the switch to Collect that opens the store picker when no store is chosen and retries
 * with the chosen one (Q-I-15). Every request goes through `useCartMutations`: totals always come from the response.
 */
export function useCartUi({ onStoreChanged }: { onStoreChanged?: () => void } = {}) {
  const t = useTranslations('cart');
  const mutations = useCartMutations();
  const { store, open, isOpen } = useCollectionStore();
  const [message, setMessage] = useState<string | null>(null);
  // Refs, not state: they only decide what to do when the store picker reports a choice or closes.
  const awaiting = useRef<{ lineId: string; sku: string } | null>(null);
  const changing = useRef(false);
  const wasOpen = useRef(false);
  const storeChangedRef = useRef(onStoreChanged);
  useEffect(() => {
    storeChangedRef.current = onStoreChanged;
  }, [onStoreChanged]);

  const report = useCallback(
    (e: unknown) => {
      if (!(e instanceof ApiError)) return setMessage(t('error.generic'));
      if (e.code === 'conflict') return setMessage(t('error.conflict'));
      if (e.code === 'quantity_exceeds_stock') return setMessage(t('notice.quantityLimit', { n: Number(e.extra.available ?? 0) }));
      if (e.code === 'not_available_for_collection') return setMessage(t('error.collectUnavailable'));
      if (e.code === 'code_not_applied') return undefined; // shown inline by the code form
      return setMessage(t('error.generic'));
    },
    [t],
  );

  const guarded = useCallback(
    async <T,>(run: () => Promise<T>): Promise<T | undefined> => {
      setMessage(null);
      try {
        return await run();
      } catch (e) {
        report(e);
        return undefined;
      }
    },
    [report],
  );

  const setQuantity = useCallback(
    (line: CartLine, quantity: number) => (quantity < 1 ? Promise.resolve(undefined) : guarded(() => mutations.setQuantity(line.id, quantity))),
    [guarded, mutations],
  );
  const remove = useCallback((line: CartLine) => guarded(() => mutations.remove(line.id)), [guarded, mutations]);
  const ship = useCallback((line: CartLine) => guarded(() => mutations.switchFulfilment(line.id, { fulfilment: 'delivery' })), [guarded, mutations]);

  const collectWith = useCallback(
    async (line: { id: string; sku: string }, storeKey?: string) => {
      setMessage(null);
      try {
        await mutations.switchFulfilment(line.id, storeKey ? { fulfilment: 'collect', storeKey } : { fulfilment: 'collect' });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'store_required') {
          awaiting.current = { lineId: line.id, sku: line.sku };
          open({ sku: line.sku });
        } else report(e);
      }
    },
    [mutations, open, report],
  );
  const collect = useCallback((line: CartLine) => collectWith(line, store?.key), [collectWith, store?.key]);

  const changeStore = useCallback(
    async (storeKey: string) => {
      const out = await guarded(() => mutations.changeStore(storeKey));
      storeChangedRef.current?.();
      return out;
    },
    [guarded, mutations],
  );
  const lastKey = useRef<string | undefined>(store?.key);
  // The picker was opened for a switch to Collect or for "Change store": a chosen store completes it (once); closing the
  // picker without a choice cancels it.
  useEffect(() => {
    if (isOpen) wasOpen.current = true;
    const picked = store !== null && store.key !== lastKey.current;
    lastKey.current = store?.key;
    if (awaiting.current && store) {
      const line = awaiting.current;
      awaiting.current = null;
      wasOpen.current = false;
      void collectWith({ id: line.lineId, sku: line.sku }, store.key);
    } else if (changing.current && picked && store) {
      changing.current = false;
      wasOpen.current = false;
      void changeStore(store.key);
    } else if ((awaiting.current || changing.current) && !isOpen && wasOpen.current) {
      awaiting.current = null;
      changing.current = false;
      wasOpen.current = false;
    }
  }, [store, isOpen, collectWith, changeStore]);

  /** "Change store": opens the picker; a chosen store moves every collect line (`PATCH /api/cart`). */
  const openStoreChange = useCallback(() => {
    changing.current = true;
    open();
  }, [open]);

  return {
    mutations, message, clearMessage: () => setMessage(null), report, setQuantity, remove, ship, collect, changeStore, openStoreChange,
    selectedStoreKey: store?.key ?? null,
  };
}

export type CartUi = ReturnType<typeof useCartUi>;

/** Lines grouped for rendering: the group, then its lines, in cart order. */
export function linesOf(cart: Cart, lineIds: readonly string[]): CartLine[] {
  const byId = new Map(cart.lines.map((l) => [l.id, l]));
  return lineIds.map((id) => byId.get(id)).filter((l): l is CartLine => Boolean(l));
}
