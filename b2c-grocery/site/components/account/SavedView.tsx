'use client';

import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useSavedIds, useWishlistMutations } from '@/hooks/useSaved';
import { useSavedProducts } from '@/hooks/useSavedProducts';
import type { Product } from '@/lib/types';
import { SavedCard } from './SavedCard';

/**
 * "Put aside": kicker with the count, H1, a four-column grid of cards or the empty state. The products are fetched
 * once; what is shown follows the saved ids in the SWR cache, so a removal (optimistic, rolled back on failure) or a
 * heart toggled elsewhere shows up at once.
 */
export function SavedView() {
  const t = useTranslations('account.saved');
  const locale = useLocale();
  const toast = useToast();
  const { data: products, error, mutate } = useSavedProducts(locale);
  const ids = useSavedIds();
  const { unsave } = useWishlistMutations();
  const [removing, setRemoving] = useState<string[]>([]);

  const remove = useCallback(
    async (product: Product) => {
      setRemoving((r) => [...r, product.id]);
      try {
        await unsave(product.id);
      } catch {
        toast.show({ message: t('removeFailed') });
      } finally {
        setRemoving((r) => r.filter((id) => id !== product.id));
      }
    },
    [toast, t, unsave],
  );

  const shown = products && (ids ? products.filter((p) => ids.includes(p.id)) : products);

  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      {shown && shown.length > 0 ? <h6 className="text-accent-700">{t('count', { count: shown.length })}</h6> : null}
      <h1 className="mb-(--space-6) text-[52px]">{t('title')}</h1>
      {error && !products ? (
        <div role="alert" className="flex flex-col items-start gap-(--space-4)">
          <p className="m-0 text-[17px] text-muted">{t('loadFailed')}</p>
          <Button variant="secondary" onClick={() => void mutate()}>
            {t('retry')}
          </Button>
        </div>
      ) : !shown ? (
        <p aria-busy="true" className="text-[17px] text-muted">
          {t('loading')}
        </p>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-start gap-(--space-4)">
          <p className="m-0 text-[17px] text-muted">{t('empty')}</p>
          <Button href="/shop">{t('browse')}</Button>
        </div>
      ) : (
        <ul aria-label={t('list')} className="m-0 grid list-none grid-cols-1 gap-(--space-4) p-0 tablet:grid-cols-2 desktop:grid-cols-4">
          {shown.map((product) => (
            <li key={product.id}>
              <SavedCard product={product} removing={removing.includes(product.id)} onRemove={(p) => void remove(p)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
