import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cx } from './cx';

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  pageCount: number;
  /** Link mode (search/list pages keep the page in the URL). */
  hrefFor?: (page: number) => string;
  /** Button mode. */
  onChange?: (page: number) => void;
  className?: string;
}

/** Page numbers with an ellipsis: always first, last and a window of one page around the current one. */
export function pageItems(page: number, pageCount: number): Array<number | 'gap'> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  pages.forEach((p, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && p - previous > 1) items.push('gap');
    items.push(p);
  });
  return items;
}

const CELL = 'inline-flex min-w-10 items-center justify-center rounded-sm border border-border px-3 py-2 font-display text-sm font-medium';
const CURRENT = 'border-action bg-action text-action-label';
const IDLE = 'bg-surface text-navy-700 hover:bg-brand-50';
const OFF = 'cursor-not-allowed opacity-45';

export function Pagination({ page, pageCount, hrefFor, onChange, className }: PaginationProps) {
  const t = useTranslations('ui.pagination');
  if (pageCount <= 1) return null;

  const control = (target: number, content: string, ariaLabel: string, { disabled = false, current = false } = {}) => {
    const classes = cx(CELL, current ? CURRENT : IDLE, disabled && OFF);
    if (disabled) {
      return (
        <button type="button" disabled aria-label={ariaLabel} className={classes}>
          {content}
        </button>
      );
    }
    if (hrefFor) {
      return (
        <Link href={hrefFor(target)} aria-label={ariaLabel} aria-current={current ? 'page' : undefined} className={classes}>
          {content}
        </Link>
      );
    }
    return (
      <button type="button" aria-label={ariaLabel} aria-current={current ? 'page' : undefined} onClick={() => onChange?.(target)} className={classes}>
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={t('label')} className={className}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        <li>{control(page - 1, t('previous'), t('previous'), { disabled: page <= 1 })}</li>
        {pageItems(page, pageCount).map((item, index) => (
          <li key={item === 'gap' ? `gap-${index}` : item}>
            {item === 'gap' ? (
              <span aria-hidden="true" className="px-1 text-neutral-500">
                …
              </span>
            ) : (
              control(item, String(item), t('page', { page: item }), { current: item === page })
            )}
          </li>
        ))}
        <li>{control(page + 1, t('next'), t('next'), { disabled: page >= pageCount })}</li>
      </ul>
    </nav>
  );
}
