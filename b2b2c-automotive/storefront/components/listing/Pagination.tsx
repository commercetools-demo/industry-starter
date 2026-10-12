// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { listingHref as hrefFor, type ListingParams } from '@/lib/search/params';

/** Pages to show: the first, the last and the current page with two neighbours each side; `null` marks a gap. */
export function pageWindow(current: number, total: number): (number | null)[] {
  const wanted = new Set([1, total]);
  for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= total) wanted.add(p);
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const ITEM = 'inline-flex min-h-7 min-w-7 items-center justify-center rounded-xs border px-3 font-ui text-sm';

/** Numbered links that keep every filter, sort and the query. Server rendered; nothing is shown for a single page. */
export function Pagination({ params, page, totalPages, basePath }: { params: ListingParams; page: number; totalPages: number; basePath: string }) {
  const t = useTranslations('pagination');
  if (totalPages <= 1) return null;
  const to = (p: number) => hrefFor(basePath, { ...params, page: p });
  return (
    <nav aria-label={t('label')} className="mt-5">
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0">
        {page > 1 ? (
          <li>
            <Link href={to(page - 1)} rel="prev" className={`${ITEM} border-border-strong bg-surface text-text hover:bg-surface-subtle`}>
              {t('previous')}
            </Link>
          </li>
        ) : null}
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-text-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={to(p)}
                aria-label={p === page ? t('current', { page: p }) : t('page', { page: p })}
                aria-current={p === page ? 'page' : undefined}
                className={`${ITEM} ${p === page ? 'border-border-brand bg-action text-text-on-brand' : 'border-border-strong bg-surface text-text hover:bg-surface-subtle'}`}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link href={to(page + 1)} rel="next" className={`${ITEM} border-border-strong bg-surface text-text hover:bg-surface-subtle`}>
              {t('next')}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
