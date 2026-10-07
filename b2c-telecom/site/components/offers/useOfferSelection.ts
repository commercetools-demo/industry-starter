'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { useCartContext } from '@/context/CartProvider';
import { CartError } from '@/hooks/useCart';
import type { BlockedAdd, CartLine, Offer } from '@/lib/types';

/** A question the buyer must answer before the cart changes. */
export type PendingChoice =
  /** The add was refused because a plan the buyer holds cannot be kept with this one (same category or declared conflict). */
  | { kind: 'replace'; heldName: string; replaceLineId: string; dependentCount: number; sku: string; quantity: number }
  /** Removing a plan takes its add-ons and equipment with it (D-026). */
  | { kind: 'remove'; dependentCount: number };

export interface OfferSelection {
  /** The plan's own line in the bundle; `Selected` is derived from it, never stored. */
  planLine: CartLine | undefined;
  /** Add-ons and equipment attached to the plan line. */
  dependents: CartLine[];
  busy: boolean;
  /** The bundle has not been read yet (the first client render equals the server HTML). */
  loading: boolean;
  pending: PendingChoice | null;
  /** The reasons the server gave for refusing an add that cannot be fixed by replacing something (absolute, D-022). */
  blocked: BlockedAdd | null;
  choose: (sku: string, quantity: number) => Promise<void>;
  deselect: () => Promise<void>;
  changeQuantity: (quantity: number) => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => void;
  dismissBlocked: () => void;
}

/**
 * "Choose plan" / "Selected" of one plan card. The server is the authority: every add goes to `POST /api/cart/line-items`, which re-runs
 * compatibility, exclusivity, eligibility and one-plan-per-category and adds the required equipment itself, so there is no separate
 * pre-check here. A refusal with a replace target becomes a confirmation (the buyer decides, nothing is swapped silently); any other
 * refusal is shown with its reasons and leaves the bundle untouched. Calls run one after the other (the cart is versioned).
 */
export function useOfferSelection(offer: Offer): OfferSelection {
  const t = useTranslations('bundle');
  const toast = useToast();
  const { cart, isLoading, addLine, removeLine, setQuantity } = useCartContext();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingChoice | null>(null);
  const [blocked, setBlocked] = useState<BlockedAdd | null>(null);
  const running = useRef(false);

  const planLine = cart?.lines.find((line) => line.offerKey === offer.key && line.kind === 'plan');
  const dependents = planLine ? (cart?.lines.filter((line) => line.parentLineId === planLine.id) ?? []) : [];

  const run = useCallback(async (work: () => Promise<void>): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  const fail = useCallback(
    (error: unknown): BlockedAdd | undefined => {
      const refusal = error instanceof CartError ? error.blocked : undefined;
      if (!refusal) toast.show({ message: t('error.generic'), tone: 'error' });
      return refusal;
    },
    [t, toast],
  );

  const add = useCallback(
    (sku: string, quantity: number, replaceLineId?: string): Promise<void> =>
      run(async () => {
        setBlocked(null);
        try {
          await addLine({ offerKey: offer.key, sku, quantity, ...(replaceLineId ? { replaceLineId } : {}) });
          toast.show({ message: t('toast.added', { name: offer.name }), actionLabel: t('toast.view'), href: '/bundle' });
        } catch (error) {
          const refusal = fail(error);
          if (!refusal) return;
          const replace = refusal.replace;
          if (refusal.kind === 'conflict' && replace && !replaceLineId) {
            setPending({
              kind: 'replace',
              heldName: replace.removeOfferName,
              replaceLineId: replace.removeLineId,
              dependentCount: cart?.lines.filter((line) => line.parentLineId === replace.removeLineId).length ?? 0,
              sku,
              quantity,
            });
          } else {
            setBlocked(refusal);
          }
        }
      }),
    [addLine, cart, fail, offer.key, offer.name, run, t, toast],
  );

  const remove = useCallback(
    (line: CartLine, cascade: boolean): Promise<void> =>
      run(async () => {
        setBlocked(null);
        try {
          await removeLine(line.id, cascade ? { cascade: true } : undefined);
        } catch (error) {
          fail(error);
        }
      }),
    [fail, removeLine, run],
  );

  const deselect = useCallback(async (): Promise<void> => {
    if (!planLine) return;
    if (dependents.length > 0) {
      setPending({ kind: 'remove', dependentCount: dependents.length });
      return;
    }
    await remove(planLine, false);
  }, [dependents.length, planLine, remove]);

  const changeQuantity = useCallback(
    (quantity: number): Promise<void> =>
      run(async () => {
        if (!planLine) return;
        setBlocked(null);
        try {
          await setQuantity(planLine.id, quantity);
        } catch (error) {
          const refusal = fail(error);
          if (refusal) setBlocked(refusal);
        }
      }),
    [fail, planLine, run, setQuantity],
  );

  const confirm = useCallback(async (): Promise<void> => {
    const choice = pending;
    setPending(null);
    if (!choice) return;
    if (choice.kind === 'replace') await add(choice.sku, choice.quantity, choice.replaceLineId);
    else if (planLine) await remove(planLine, true);
  }, [add, pending, planLine, remove]);

  return {
    planLine,
    dependents,
    busy,
    loading: isLoading,
    pending,
    blocked,
    choose: (sku, quantity) => add(sku, quantity),
    deselect,
    changeQuantity,
    confirm,
    cancel: () => setPending(null),
    dismissBlocked: () => setBlocked(null),
  };
}
