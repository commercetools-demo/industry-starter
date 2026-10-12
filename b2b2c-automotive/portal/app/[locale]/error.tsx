'use client';

import { useTranslations } from 'next-intl';

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  const common = useTranslations('common');
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page p-800">
      <section role="alert" className="w-full max-w-widget-desktop-4col rounded-400 bg-bg-surface p-800 shadow-card">
        <h1 className="text-h5 font-semibold text-text">{t('genericTitle')}</h1>
        <p className="mt-200 text-body-2 text-text-subdued">{t('genericBody')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-400 rounded-300 bg-bg-brand px-400 py-200 text-button-2 font-medium text-text-on hover:bg-bg-brand-hover"
        >
          {common('tryAgain')}
        </button>
      </section>
    </main>
  );
}
