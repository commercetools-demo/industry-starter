import { useLocale, useTranslations } from 'next-intl';
import { Table } from '@/components/ui/Table';
import { Link } from '@/i18n/routing';
import type { OrderListItem } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { formatDate, orderLabel } from './format';
import { OrderStatusTag } from './OrderStatusTag';

// Below `tablet` the table stacks: the header row is visually hidden and every cell shows its label (data-label).
const STACK_TABLE =
  'max-tablet:block max-tablet:[&_tbody]:block max-tablet:[&_thead]:sr-only max-tablet:[&_tr]:relative max-tablet:[&_tr]:block max-tablet:[&_tr]:border-b max-tablet:[&_tr]:border-divider max-tablet:[&_tr]:py-(--space-2) [&_th:last-child]:text-right';
const CELL =
  'max-tablet:flex max-tablet:items-baseline max-tablet:justify-between max-tablet:gap-(--space-3) max-tablet:border-b-0 max-tablet:py-[4px] max-tablet:before:text-[11px] max-tablet:before:uppercase max-tablet:before:tracking-[0.08em] max-tablet:before:text-text/60 max-tablet:before:content-[attr(data-label)]';

/** Items, order number, placed, total and a right-aligned status tag. The whole row links to the order (stretched link in the items cell). */
export function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  const t = useTranslations('account.orders');
  const locale = useLocale();
  return (
    <Table
      caption={t('caption')}
      columns={[t('colItems'), t('colNumber'), t('colPlaced'), t('colTotal'), t('colStatus')]}
      className={STACK_TABLE}
    >
      {orders.map((order) => (
        <tr key={order.id} className="relative">
          <td data-label={t('colItems')} className={CELL}>
            <Link href={`/account/orders/${order.id}`} className="text-text no-underline after:absolute after:inset-0 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent">
              {order.itemSummary}
            </Link>
          </td>
          <td data-label={t('colNumber')} className={`${CELL} text-text/60`}>
            {orderLabel(order)}
          </td>
          <td data-label={t('colPlaced')} className={`${CELL} text-text/60`}>
            {formatDate(order.createdAt, locale)}
          </td>
          <td data-label={t('colTotal')} className={CELL}>
            {formatMoney(order.total.centAmount, order.total.currencyCode, locale)}
          </td>
          <td data-label={t('colStatus')} className={`${CELL} text-right`}>
            <OrderStatusTag status={order.status} />
          </td>
        </tr>
      ))}
    </Table>
  );
}
