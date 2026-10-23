'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PanelState from '@/components/account/PanelState';
import SkippedLinesDialog from '@/components/account/SkippedLinesDialog';
import ProductCard from '@/components/product/ProductCard';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { useToast } from '@/context/toast';
import { useCartCount } from '@/hooks/useCartCount';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useSavedList } from '@/hooks/useSavedList';
import type { SavedAddAllResult, SavedItem } from '@/lib/types';

/**
 * Saved items: a card grid of the customer's saved products, "Add all to bag" (the list stays as it is), an explicit empty
 * state with Browse, and "Save items from my bag" when the bag has lines. The heart on a card removes it from the grid at once.
 */
export default function SavedTab() {
  const t = useTranslations('account.saved');
  const tTabs = useTranslations('account.tabs');
  const toast = useToast();
  const saved = useSavedList();
  const { isSaved, toggle, ready } = useSavedItems();
  const bagCount = useCartCount();
  const [busy, setBusy] = useState<'all' | 'bag' | null>(null);
  const [skipped, setSkipped] = useState<SavedAddAllResult['skipped'] | null>(null);

  // The heart state is the truth: a product whose heart went off leaves the grid at once, before the server answers.
  const items: SavedItem[] = (saved.list?.items ?? []).filter((i) => !ready || isSaved(i.productId));
  const cards = items.filter((i) => i.product);
  const gone = items.filter((i) => !i.product);

  const addAll = async () => {
    setBusy('all');
    try {
      const res = await saved.addAll();
      const count = res.added.reduce((n, l) => n + l.quantity, 0);
      toast.show(count > 0 ? t('added', { count }) : t('nothingAdded'));
      if (res.skipped.length > 0) setSkipped(res.skipped);
    } catch {
      toast.show(t('failed'));
    } finally {
      setBusy(null);
    }
  };

  const fromBag = async () => {
    setBusy('bag');
    try {
      await saved.fromBag();
    } catch {
      toast.show(t('fromBagFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="saved-heading">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 id="saved-heading" className="m-0 font-display text-[22px] font-bold text-ink">
          {t('title')}
        </h2>
        {items.length > 0 ? (
          <Button variant="ghost" loading={busy === 'all'} onClick={() => void addAll()}>
            {t('addAll')}
          </Button>
        ) : null}
      </div>
      <PanelState
        panel={tTabs('saved')}
        isLoading={saved.isLoading && !saved.list && !saved.isError}
        isError={saved.isError && !saved.list}
        isEmpty={items.length === 0}
        onRetry={() => void saved.reload()}
        empty={
          <>
            <p className="m-0 mb-4 text-[14.5px] text-ink-2">{t('empty')}</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/shop">{t('browse')}</ButtonLink>
              {bagCount > 0 ? (
                <Button variant="ghost" loading={busy === 'bag'} onClick={() => void fromBag()}>
                  {t('fromBag')}
                </Button>
              ) : null}
            </div>
          </>
        }
      >
        <ul
          className="m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-[18px] p-0 xs:gap-x-6 xs:gap-y-7 grid3:grid-cols-3"
          data-testid="saved-grid"
        >
          {cards.map((i) => (
            <li key={i.productId} className="min-w-0">
              {i.product ? <ProductCard product={i.product} /> : null}
            </li>
          ))}
        </ul>
        {gone.length > 0 ? (
          <ul className="m-0 mt-5 grid list-none gap-3 p-0">
            {gone.map((i) => (
              <li key={i.productId}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="saved-gone">
                  <span className="text-[14.5px] text-ink-2">
                    <span className="font-semibold text-ink">{i.name}</span> · {t('gone')}
                  </span>
                  <Button variant="ghost" onClick={() => toggle(i.productId)}>
                    {t('remove')}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </PanelState>
      <SkippedLinesDialog
        open={skipped !== null}
        title={t('skippedTitle')}
        lines={(skipped ?? []).map((s) => ({ key: s.productId || s.name, name: s.name, reason: s.reason }))}
        onClose={() => setSkipped(null)}
      />
    </section>
  );
}
