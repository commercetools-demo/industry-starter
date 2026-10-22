'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

/** The product read failed (not "unknown product", which is a 404): a message and Retry. */
export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('pdp.error');
  return (
    <div className="wrap flex flex-col items-center gap-4 py-24 text-center">
      <title>{t('title')}</title>
      <h1 className="m-0 font-display text-[22px] font-semibold text-ink">{t('title')}</h1>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
