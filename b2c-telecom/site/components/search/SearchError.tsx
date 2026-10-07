import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** Search is down: an explicit state inside the normal page (HTTP 200, not the global error page). `retryHref` is the same URL, without the locale. */
export function SearchError({ retryHref }: { retryHref: string }): ReactElement {
  const t = useTranslations('search.error');
  return (
    <section role="alert" aria-labelledby="search-error-title" className="flex flex-col items-start gap-5 rounded-xl border border-border bg-surface-brand-subtle p-8">
      <h2 id="search-error-title" className="m-0 font-display text-2xl font-bold">
        {t('title')}
      </h2>
      <p className="m-0 max-w-xl text-md">{t('body')}</p>
      <Button href={retryHref} variant="secondary">
        {t('retry')}
      </Button>
    </section>
  );
}
