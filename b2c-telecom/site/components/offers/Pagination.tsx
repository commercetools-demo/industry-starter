import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { PAGINATION_MAX_NUMBERS } from '@/lib/config/listing';
import { cx } from '@/lib/cx';

type PaginationProps = {
  page: number;
  pageCount: number;
  /** Path without the locale, e.g. `/shop/add-ons` or `/search`. */
  basePath: string;
  /** The other parameters of the URL, kept on every link (`page` is set by this component and left out for page 1). */
  query?: Record<string, string>;
};

/** The numbers to show: all of them up to PAGINATION_MAX_NUMBERS pages, else first, a window around the current page, last (`null` = gap). */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= PAGINATION_MAX_NUMBERS) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index > 0 && n - sorted[index - 1] > 1 ? [null, n] : [n]));
}

const ITEM = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-4 font-display text-sm font-semibold no-underline';

/** Numbered pagination made of real links (shared with search). Renders nothing for a single page. */
export function Pagination({ page, pageCount, basePath, query = {} }: PaginationProps): ReactElement | null {
  const t = useTranslations('plp.pagination');
  if (pageCount <= 1) return null;
  const hrefFor = (target: number): string => {
    const search = new URLSearchParams(query);
    if (target > 1) search.set('page', String(target));
    else search.delete('page');
    const text = search.toString();
    return `${basePath}${text === '' ? '' : `?${text}`}`;
  };
  return (
    <nav aria-label={t('label')}>
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-3 p-0">
        {page > 1 ? (
          <li>
            <Link href={hrefFor(page - 1)} rel="prev" className={cx(ITEM, 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}>
              {t('previous')}
            </Link>
          </li>
        ) : null}
        {pageNumbers(page, pageCount).map((n, index) =>
          n === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-2 font-display text-sm font-semibold">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={hrefFor(n)}
                aria-label={t('page', { n })}
                aria-current={n === page ? 'page' : undefined}
                className={cx(ITEM, n === page ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pageCount ? (
          <li>
            <Link href={hrefFor(page + 1)} rel="next" className={cx(ITEM, 'bg-brand-100 text-brand-950 hover:bg-brand-200', FOCUS_RING)}>
              {t('next')}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
