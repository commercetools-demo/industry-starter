'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCartContext } from '@/context/CartProvider';
import { ApiError } from '@/lib/fetcher';
import type { CartLine } from '@/lib/types';
import { CartDeliveryStep } from './CartDeliveryStep';
import { CartLineRow } from './CartLineRow';
import { CartSummary } from './CartSummary';

const availableOf = (e: unknown): number | undefined => {
  if (!(e instanceof ApiError) || e.status !== 409) return undefined;
  const data = e.data;
  const available = typeof data === 'object' && data !== null ? (data as { available?: unknown }).available : undefined;
  return typeof available === 'number' ? available : undefined;
};

/** The bag: lines on the left, sticky summary on the right (>= 1200px), or the empty state. */
export function CartView() {
  const t = useTranslations('cart');
  const toast = useToast();
  const { cart, isLoading, setQuantity, removeLine, addItem } = useCartContext();
  /** Optimistic quantity per line while its request is in flight; dropped on completion (rollback on failure). */
  const [pending, setPending] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const clearPending = useCallback((id: string) => {
    setPending((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }, []);

  const changeQuantity = useCallback(
    async (line: CartLine, quantity: number) => {
      setError(null);
      setPending((p) => ({ ...p, [line.id]: quantity }));
      try {
        await setQuantity(line.id, quantity);
      } catch (e) {
        const available = availableOf(e);
        setError(available === undefined ? t('updateFailed') : available > 0 ? t('insufficientStock', { available }) : t('outOfStock'));
      } finally {
        clearPending(line.id);
      }
    },
    [clearPending, setQuantity, t],
  );

  const remove = useCallback(
    async (line: CartLine) => {
      setError(null);
      setPending((p) => ({ ...p, [line.id]: line.quantity }));
      try {
        await removeLine(line.id);
      } catch {
        setError(t('updateFailed'));
        return;
      } finally {
        clearPending(line.id);
      }
      toast.show({
        message: t('removed'),
        actionLabel: t('undo'),
        onAction: () => {
          addItem(line.sku, line.quantity, line.recurrence ? { recurrencePolicyKey: line.recurrence.policyKey } : {}).catch(() =>
            toast.show({ message: t('updateFailed') }),
          );
        },
      });
    },
    [addItem, clearPending, removeLine, t, toast],
  );

  const lines = cart?.lines ?? [];
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      <h1 className="mb-(--space-6) text-[52px]">{t('title')}</h1>
      {cart && lines.length > 0 ? (
        <div className="grid items-start gap-[42px] desktop:grid-cols-[1.5fr_1fr]">
          <div>
            {error ? (
              <p role="alert" className="mb-(--space-4) rounded-[var(--radius-md)] bg-accent-100 px-(--space-4) py-(--space-3) text-[14px] text-accent-800">
                {error}
              </p>
            ) : null}
            <CartDeliveryStep />
            <ul className="m-0 flex list-none flex-col p-0">
              {lines.map((line) => (
                <CartLineRow
                  key={line.id}
                  line={line}
                  displayQuantity={pending[line.id] ?? line.quantity}
                  busy={line.id in pending}
                  onQuantityChange={changeQuantity}
                  onRemove={remove}
                />
              ))}
            </ul>
          </div>
          <CartSummary cart={cart} />
        </div>
      ) : isLoading ? (
        <p aria-busy="true" className="text-[17px] text-muted">
          {t('loading')}
        </p>
      ) : (
        <div className="flex flex-col items-start gap-(--space-4)">
          <p className="m-0 text-[17px] text-muted">{t('empty')}</p>
          <Button href="/shop">{t('browse')}</Button>
        </div>
      )}
    </div>
  );
}
