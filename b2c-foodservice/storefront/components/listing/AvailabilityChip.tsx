'use client';

import { useLocale, useTranslations } from 'next-intl';
import Chip from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { useRouter } from '@/i18n/routing';
import { marketForLocale } from '@/lib/utils';

/**
 * "Available at {store}" toggle (collection stores only, so absent in Canada). With no store chosen a click opens the
 * store picker; once a store is chosen it navigates to `href` (the URL with `avail` toggled).
 */
export default function AvailabilityChip({ active, href }: { active: boolean; href: string }) {
  const t = useTranslations('plp');
  const market = marketForLocale(useLocale());
  const router = useRouter();
  const { store, stores, isLoading, error, open } = useCollectionStore();
  if (!market.collection) return null;
  if (!isLoading && !error && stores.length === 0) return null;
  return (
    <Chip
      active={active && Boolean(store)}
      onClick={() => (store ? router.push(href) : open())}
      className="inline-flex items-center gap-2"
    >
      <Icon name="store" size={15} />
      {store ? t('availableAt', { store: store.name }) : t('availableChoose')}
    </Chip>
  );
}
