'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <main>
      <h1>{t('title')}</h1>
      <button type="button" onClick={reset}>
        {t('retry')}
      </button>
    </main>
  );
}
