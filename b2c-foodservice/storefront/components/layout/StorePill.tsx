'use client';

import { useLocale, useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { marketForLocale } from '@/lib/utils';

/** "Collect at {store}" or "Choose a store". Renders nothing in a market without collection (Canada, D-035). */
export default function StorePill() {
  const t = useTranslations('shell.storePill');
  const market = marketForLocale(useLocale());
  const { store, stores, isLoading, error, open } = useCollectionStore();

  if (!market.collection) return null;
  if (!isLoading && !error && stores.length === 0) return null;

  const text = store ? t('collectAt', { store: store.name }) : t('choose');
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label={t('aria', { store: store ? store.name : t('choose') })}
      className="transition-state inline-flex min-w-0 shrink items-center gap-2 rounded-pill border border-line-2 bg-transparent px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink max-[1100px]:px-2 max-[420px]:hidden"
    >
      <Icon name="pin" size={16} className="shrink-0 text-accent" />
      <span className="min-w-0 max-w-[230px] truncate max-[1100px]:hidden">{text}</span>
    </button>
  );
}
