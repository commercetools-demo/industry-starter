import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { listingHref, type ListingParams, type ListingScope } from '@/lib/search/params';

/** Page numbers to show: first, last, the current page and two each side, with ellipses (`0`) for the gaps. */
export function pageWindow(page: number, pageCount: number): number[] {
  const keep = new Set([1, pageCount, ...[-2, -1, 0, 1, 2].map((d) => page + d)]);
  const nums = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: number[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - (nums[i - 1] as number) > 1) out.push(0);
    out.push(n);
  });
  return out;
}

/** Server-rendered pagination links; filters and sort are kept (the href is the current state with another page). */
export default function Pagination({
  page, pageCount, basePath, params, scope,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: ListingParams;
  scope: ListingScope;
}) {
  const t = useTranslations('plp.pagination');
  if (pageCount <= 1) return null;
  const href = (n: number) => listingHref(basePath, { ...params, page: n }, scope);
  const item = 'inline-flex h-10 min-w-10 items-center justify-center rounded-pill px-3 text-[14px] font-medium no-underline';
  return (
    <nav aria-label={t('aria')} className="mt-10 flex justify-center">
      <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {page > 1 ? (
          <li><Link href={href(page - 1)} rel="prev" className={cn(item, 'border border-line-2 text-ink hover:border-ink')}>{t('previous')}</Link></li>
        ) : null}
        {pageWindow(page, pageCount).map((n, i) =>
          n === 0 ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-3">…</li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={t('page', { n })}
                aria-current={n === page ? 'page' : undefined}
                className={cn(item, n === page ? 'bg-ink text-surface' : 'text-ink hover:bg-ink/6')}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pageCount ? (
          <li><Link href={href(page + 1)} rel="next" className={cn(item, 'border border-line-2 text-ink hover:border-ink')}>{t('next')}</Link></li>
        ) : null}
      </ul>
    </nav>
  );
}
