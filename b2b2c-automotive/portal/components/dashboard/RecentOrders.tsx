'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRecentOrders } from '@/hooks/dashboard';
import type { DashboardOrder } from '@/lib/dashboard/types';
import { formatMoney } from '@/lib/utils';
import { StatusChip } from './StatusChip';
import { statusOf, WidgetCard } from './WidgetCard';

export function OrdersList({ orders }: { orders: DashboardOrder[] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  if (orders.length === 0) return <p data-testid="orders-empty" className="text-body-2 font-medium text-text-subdued">{t('orders.empty')}</p>;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-2">
        <thead>
          <tr className="text-caption-1 font-semibold text-text-subdued">
            <th scope="col" className="pb-200 pr-300 font-semibold">{t('orders.number')}</th>
            <th scope="col" className="pb-200 pr-300 font-semibold max-lg:hidden">{t('orders.date')}</th>
            <th scope="col" className="pb-200 pr-300 font-semibold max-lg:hidden">{t('orders.customer')}</th>
            <th scope="col" className="pb-200 pr-300 text-right font-semibold">{t('orders.total')}</th>
            <th scope="col" className="pb-200 font-semibold">{t('orders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border-subdued">
              <td className="py-200 pr-300 font-semibold text-text">{o.orderNumber}</td>
              <td className="py-200 pr-300 text-text-subdued max-lg:hidden">{date.format(new Date(o.createdAt))}</td>
              <td className="py-200 pr-300 text-text max-lg:hidden">{o.customer}</td>
              <td className="py-200 pr-300 text-right font-semibold text-text">{formatMoney(o.total.centAmount, o.total.currencyCode, locale, o.total.fractionDigits)}</td>
              <td className="py-200"><StatusChip chip={o.chip} label={t(`chip.${o.chip}`)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecentOrders() {
  const t = useTranslations('dashboard');
  const orders = useRecentOrders();
  return (
    <WidgetCard testId="widget-orders" title={t('orders.title')} status={statusOf(orders)} errorTitle={t('orders.errorTitle')} errorMessage={t('orders.errorMessage')} onRetry={orders.retry}>
      <OrdersList orders={orders.data?.orders ?? []} />
    </WidgetCard>
  );
}
