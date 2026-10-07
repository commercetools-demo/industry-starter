import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';

/** The project has no search language for this locale: say so instead of showing an empty result (the language switch is in the header). */
export function UnsupportedLanguage(): ReactElement {
  const t = useTranslations('search.unsupported');
  return (
    <section role="alert" aria-labelledby="search-unsupported-title" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface-brand-subtle p-8">
      <h2 id="search-unsupported-title" className="m-0 font-display text-2xl font-bold">
        {t('title')}
      </h2>
      <p className="m-0 max-w-xl text-md">{t('body')}</p>
    </section>
  );
}
