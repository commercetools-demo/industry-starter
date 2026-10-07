import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, OrderListItem } from '@/lib/types';
import { OrderStatusTag } from './OrderStatusTag';

/** The newest orders of the dashboard: number, date, status, total, link; or the explicit empty state. */
export function RecentOrders({ orders }: { orders: OrderListItem[] }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="m-0 text-md">{t('recent.empty')}</p>
        <Button href="/shop/phone-plans">{t('recent.browse')}</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col p-0">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border py-4 first:border-t-0">
            <div className="flex flex-col gap-1">
              <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}`} className={cx('font-display text-lg font-semibold', FOCUS_RING)}>
                {order.orderNumber}
              </Link>
              <span className="text-sm text-text-muted">{formatDate(order.createdAt, locale)}</span>
            </div>
            <OrderStatusTag status={order.status} />
            <span className="font-display text-lg font-semibold">{formatMoneyExact(order.total, locale)}</span>
          </li>
        ))}
      </ul>
      <Link href="/account/orders" className={cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
        {t('recent.all')}
      </Link>
    </div>
  );
}
