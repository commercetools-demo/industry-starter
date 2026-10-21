'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';
import SkippedLinesDialog from '@/components/account/SkippedLinesDialog';
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
    <SkippedLinesDialog
      open={result !== null}
      title={t('skippedTitle')}
      lines={(result?.skipped ?? []).map((l) => ({ key: l.sku, name: l.name, reason: l.reason }))}
      onClose={() => setResult(null)}
    />
  );
  return { reorder, pendingId, dialog };
}
