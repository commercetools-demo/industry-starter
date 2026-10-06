import { useTranslations } from 'next-intl';
import { cx } from '@/components/ui/cx';
import { Link } from '@/i18n/routing';

type PaginationProps = {
  /** Locale-less path, e.g. `/shop` or `/search`. */
  basePath: string;
  /** The other query parameters to preserve (e.g. `{ q }`); `page` is managed here. */
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
};

/** Page numbers to show: all up to 7 pages, otherwise first, last and the current page with its neighbours (`null` = ellipsis). */
export function pageItems(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) items.push(null);
    items.push(n);
  });
  return items;
}

function hrefFor(basePath: string, params: PaginationProps['params'], page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}

const pill = 'btn btn-secondary min-w-9 aria-[current=page]:border-accent aria-[current=page]:bg-accent aria-[current=page]:text-bg';

/** Previous, numbers, Next as real links (`?page=N`); nothing is rendered for a single page. Reused by search. */
export function Pagination({ basePath, params, page, pageCount }: PaginationProps) {
  const t = useTranslations('plp.pagination');
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(page, 1), pageCount);
  return (
    <nav aria-label={t('label')} className="mt-(--space-8) flex justify-center">
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-(--space-2) p-0">
        {current > 1 ? (
          <li>
            <Link href={hrefFor(basePath, params, current - 1)} rel="prev" className={pill}>
              {t('previous')}
            </Link>
          </li>
        ) : null}
        {pageItems(current, pageCount).map((item, index) =>
          item === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-(--space-1) text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(basePath, params, item)}
                aria-current={item === current ? 'page' : undefined}
                aria-label={t('page', { page: item })}
                className={cx(pill)}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {current < pageCount ? (
          <li>
            <Link href={hrefFor(basePath, params, current + 1)} rel="next" className={pill}>
              {t('next')}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
