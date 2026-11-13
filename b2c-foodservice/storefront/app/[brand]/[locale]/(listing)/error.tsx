'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

/** Search or projection failed: a message and Retry (`reset`). A facet-only failure never reaches here. */
export default function ListingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('plp.error');
  return (
    <div className="wrap flex flex-col items-center gap-4 py-24 text-center">
      <title>{t('title')}</title>
      <h1 className="m-0 font-display text-[22px] font-semibold text-ink">{t('title')}</h1>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
