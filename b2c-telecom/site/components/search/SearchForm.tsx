import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { MAX_QUERY_LENGTH } from '@/lib/config/search';
import { cx } from '@/lib/cx';

/**
 * The search field (undrawn: Junior design choice, D-068). A plain GET form, no client JavaScript: the query is always editable and
 * a submit goes to a new page 1 (category, sort and page are not sent). The action carries the locale prefix.
 */
export function SearchForm({ q = '', className }: { q?: string; className?: string }): ReactElement {
  const t = useTranslations('search');
  const locale = useLocale();
  return (
    <form role="search" method="get" action={`/${locale}/search`} className={cx('flex w-full max-w-2xl flex-col gap-3 sm:flex-row', className)}>
      <label htmlFor="search-q" className="sr-only">
        {t('inputLabel')}
      </label>
      <input
        id="search-q"
        type="search"
        name="q"
        defaultValue={q}
        maxLength={MAX_QUERY_LENGTH}
        autoComplete="off"
        placeholder={t('placeholder')}
        className={cx('min-h-14 w-full flex-1 rounded-pill border border-neutral-400 bg-surface px-6 text-md text-text', FOCUS_RING)}
      />
      <button
        type="submit"
        className={cx('inline-flex min-h-14 items-center justify-center rounded-pill bg-action px-8 font-cta text-md font-extrabold text-text-on-pink hover:bg-action-hover', FOCUS_RING)}
      >
        {t('submit')}
      </button>
    </form>
  );
}
