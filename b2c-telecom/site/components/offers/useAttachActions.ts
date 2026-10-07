'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useReasonText } from '@/components/bundle/useReasonText';
import { useCartContext } from '@/context/CartProvider';
import { CartError } from '@/hooks/useCart';
import type { CartLine, Offer } from '@/lib/types';

export interface AttachActions {
  /** The offer key being written, if any (its row shows a busy state; the others wait). */
  busyKey: string | null;
  /** Text under a row after a refusal, by offer key. */
  errors: Record<string, string>;
  attach: (offer: Offer, sku: string, quantity: number, parentLineId: string, replaceLineId?: string) => Promise<void>;
  detach: (offer: Offer, line: CartLine) => Promise<void>;
}

/**
 * Adds an add-on or equipment to a plan line and removes it again. One write at a time (the cart is versioned). The checkbox state is
 * derived from the bundle, so a server refusal needs no rollback: nothing changed, and the reason the server gave appears under the row
 * ("Server re-checks what the card allowed").
 */
export function useAttachActions(): AttachActions {
  const { addLine, removeLine } = useCartContext();
  const reasonText = useReasonText();
  const generic = useTranslations('bundle')('error.generic');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const running = useRef(false);

  const run = useCallback(
    async (offerKey: string, work: () => Promise<unknown>): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setBusyKey(offerKey);
      setErrors((current) => {
        const next = { ...current };
        delete next[offerKey];
        return next;
      });
      try {
        await work();
      } catch (error) {
        const blocked = error instanceof CartError ? error.blocked : undefined;
        const message = blocked?.reasons[0] ? reasonText(blocked.reasons[0]) : generic;
        setErrors((current) => ({ ...current, [offerKey]: message }));
      } finally {
        running.current = false;
        setBusyKey(null);
      }
    },
    [generic, reasonText],
  );

  const attach = useCallback<AttachActions['attach']>(
    (offer, sku, quantity, parentLineId, replaceLineId) =>
      run(offer.key, () => addLine({ offerKey: offer.key, sku, quantity, parentLineId, ...(replaceLineId ? { replaceLineId } : {}) })),
    [addLine, run],
  );
  const detach = useCallback<AttachActions['detach']>((offer, line) => run(offer.key, () => removeLine(line.id)), [removeLine, run]);

  return { busyKey, errors, attach, detach };
}
