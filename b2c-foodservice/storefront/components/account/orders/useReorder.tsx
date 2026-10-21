'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';
import ButtonLink from '@/components/ui/ButtonLink';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/context/toast';
import { useOrderActions } from '@/hooks/useOrderActions';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';
import type { ReorderResult } from '@/lib/types';

/**
 * Buy again for an order id: pending state, a toast with the number of items added, and a dialog naming every skipped line
 * with its reason and a View bag button. Returns the handler, the pending id and the dialog to render once.
 */
export function useReorder(): { reorder: (orderId: string) => Promise<void>; pendingId: string | null; dialog: ReactNode } {
  const t = useTranslations('account.orders.reorder');
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { reorder: post } = useOrderActions();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [result, setResult] = useState<ReorderResult | null>(null);

  const reorder = async (orderId: string) => {
    setPendingId(orderId);
    try {
      const res = await post(orderId);
      await Promise.all([mutate(KEY_CART_COUNT), mutate(KEY_CART)]);
      const count = res.added.reduce((n, l) => n + l.quantity, 0);
      toast.show(count > 0 ? t('added', { count }) : t('nothingAdded'));
      if (res.skipped.length > 0) setResult(res);
    } catch {
      toast.show(t('failed'));
    } finally {
      setPendingId(null);
    }
  };

  const dialog = (
    <Modal open={result !== null} onClose={() => setResult(null)} title={t('skippedTitle')}>
      <ul className="m-0 grid list-none gap-3 p-0" data-testid="skipped-lines">
        {(result?.skipped ?? []).map((s) => (
          <li key={s.sku} className="flex flex-wrap items-baseline justify-between gap-2 text-[14.5px]">
            <span className="font-semibold text-ink">{s.name}</span>
            <span className="text-ink-3">{t(`reason.${s.reason}`)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={() => setResult(null)}>
          {t('close')}
        </Button>
        <ButtonLink href="/cart" onClick={() => setResult(null)}>
          {t('viewBag')}
        </ButtonLink>
      </div>
    </Modal>
  );
  return { reorder, pendingId, dialog };
}
