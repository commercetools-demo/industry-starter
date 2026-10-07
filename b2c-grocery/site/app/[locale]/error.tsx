'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-[640px] px-(--space-4) py-(--space-8) text-center">
      <h6 className="text-accent-700">{t('kicker')}</h6>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <div className="flex flex-wrap justify-center gap-(--space-3)">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button href="/shop" variant="secondary">
          {t('backToShop')}
        </Button>
      </div>
    </div>
  );
}
