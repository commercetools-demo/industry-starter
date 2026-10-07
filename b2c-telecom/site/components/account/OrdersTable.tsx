import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, OrderListItem } from '@/lib/types';
import { OrderStatusTag } from './OrderStatusTag';

const HEAD = 'px-5 py-4 text-left font-display text-xs font-semibold uppercase tracking-ui';
// Below 640 px a row becomes a block and every cell shows its column name on the left (`data-label`), the value on the right.
const CELL = 'border-t border-border px-5 py-4 align-top max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-5 max-sm:border-t-0 max-sm:px-0 max-sm:py-2 max-sm:before:font-display max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:uppercase max-sm:before:text-text-muted max-sm:before:content-[attr(data-label)]';

/** The order list: number (link), date, items, status, and "{one-time} today · {monthly}/mo". */
export function OrdersTable({ orders }: { orders: OrderListItem[] }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;
  const fmt = (money: OrderListItem['total']): string => formatMoneyExact(money, locale);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse max-sm:block">
        <caption className="sr-only">{t('orders.listLabel')}</caption>
        <thead className="bg-neutral-50 max-sm:sr-only">
          <tr>
            <th scope="col" className={HEAD}>
              {t('orders.cols.order')}
            </th>
            <th scope="col" className={HEAD}>
              {t('orders.cols.placed')}
            </th>
            <th scope="col" className={HEAD}>
              {t('orders.cols.items')}
            </th>
            <th scope="col" className={HEAD}>
              {t('orders.cols.status')}
            </th>
            <th scope="col" className={HEAD}>
              {t('orders.cols.total')}
            </th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {orders.map((order) => (
            <tr key={order.id} className="max-sm:block max-sm:border-t max-sm:border-border max-sm:px-5 max-sm:py-4 max-sm:first:border-t-0">
              <th scope="row" data-label={t('orders.cols.order')} className={cx(CELL, 'text-left font-display font-semibold')}>
                <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}`} className={cx('text-text-link', FOCUS_RING)}>
                  {order.orderNumber}
                </Link>
              </th>
              <td data-label={t('orders.cols.placed')} className={CELL}>
                {formatDate(order.createdAt, locale)}
              </td>
              <td data-label={t('orders.cols.items')} className={CELL}>
                {order.more > 0 ? t('orders.more', { names: order.itemNames.join(', '), count: order.more }) : order.itemNames.join(', ')}
              </td>
              <td data-label={t('orders.cols.status')} className={CELL}>
                <OrderStatusTag status={order.status} />
              </td>
              <td data-label={t('orders.cols.total')} className={cx(CELL, 'font-display font-semibold')}>
                {order.monthly.centAmount > 0 ? t('orders.total', { today: fmt(order.total), monthly: fmt(order.monthly) }) : t('orders.totalOnly', { today: fmt(order.total) })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
