import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { ordersHref } from '@/lib/account/orders-query';
import type { OrderStatusFilter } from '@/lib/config/account';
import { cx } from '@/lib/cx';

const PILL = 'inline-flex min-h-11 items-center rounded-pill border-2 px-5 font-display text-sm font-semibold no-underline';

/** "Previous / Page 1 of 2 / Next" over the whole history; renders nothing for a single page. Links keep the status filter. */
export function Pagination({ status, page, pages }: { status: OrderStatusFilter; page: number; pages: number }): ReactElement | null {
  const t = useTranslations('account');
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('orders.pagination')} className="flex flex-wrap items-center justify-between gap-5">
      {page > 1 ? (
        <Link href={ordersHref(status, page - 1)} rel="prev" className={cx(PILL, 'border-action text-action', FOCUS_RING)}>
          {t('orders.previous')}
        </Link>
      ) : (
        <span aria-disabled="true" className={cx(PILL, 'border-border text-text-muted')}>
          {t('orders.previous')}
        </span>
      )}
      <span aria-live="polite" className="font-display text-sm font-semibold">
        {t('page', { page, pages })}
      </span>
      {page < pages ? (
        <Link href={ordersHref(status, page + 1)} rel="next" className={cx(PILL, 'border-action text-action', FOCUS_RING)}>
          {t('orders.next')}
        </Link>
      ) : (
        <span aria-disabled="true" className={cx(PILL, 'border-border text-text-muted')}>
          {t('orders.next')}
        </span>
      )}
    </nav>
  );
}
