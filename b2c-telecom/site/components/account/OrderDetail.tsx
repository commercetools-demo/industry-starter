import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PriceSchedule } from '@/components/bundle/PriceSchedule';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { formatDate, formatDateTime } from '@/lib/account/format';
import type { ActivePlan, Locale, Order } from '@/lib/types';
import { OrderActions } from './OrderActions';
import { OrderLines } from './OrderLines';
import { OrderStatusTag } from './OrderStatusTag';
import { OrderTotals } from './OrderTotals';
import { PlanLabels } from './PlanLabels';
import { PrintReceiptButton } from './PrintReceiptButton';
import { ReorderButton } from './ReorderButton';
import './receipt.css';

const H2 = 'm-0 font-display text-2xl font-bold tracking-ui';

/** One order: items, totals, the agreed prices, the Broadband Facts of the day, delivery, and the actions. */
export function OrderDetail({ order, customerName }: { order: Order; customerName: string }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;

  // The labels are only what was stored on the order (the snapshot rule); a plan line without one says so.
  const plans: ActivePlan[] = order.lines
    .filter((line) => line.kind === 'internet-plan' || line.kind === 'phone-plan')
    .map((line) => ({ key: line.id, orderNumber: order.orderNumber, sku: line.sku, name: line.name, label: order.labels?.find((entry) => entry.sku === line.sku)?.label ?? null }));
  const schedules = order.schedules.filter((schedule) => schedule.status === 'active');
  const address = order.shippingAddress;

  return (
    <div className="receipt-page flex flex-col gap-9">
      <div className="flex flex-col gap-3">
        <div data-print="hide">
          <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title'), href: '/account' }, { label: t('orders.title'), href: '/account/orders' }, { label: order.orderNumber }]} />
        </div>
        <p className="receipt-only">{t('order.receiptFor', { orderNumber: order.orderNumber })}</p>
        <p className="receipt-only">{t('order.receiptCustomer', { name: customerName })}</p>
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('order.heading', { orderNumber: order.orderNumber })}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-md text-text-muted">
          <span>{t('order.placed', { date: formatDateTime(order.createdAt, locale) })}</span>
          <OrderStatusTag status={order.status} />
          <span>{t('order.serviceStart', { date: formatDate(order.serviceStartDate, locale) })}</span>
        </div>
      </div>

      <section aria-labelledby="order-items" className="flex flex-col gap-5">
        <h2 id="order-items" className={H2}>
          {t('order.items')}
        </h2>
        <OrderLines order={order} />
        <OrderTotals order={order} />
      </section>

      {schedules.length > 0 ? (
        <section aria-labelledby="order-schedule" className="flex flex-col gap-5">
          <h2 id="order-schedule" className={H2}>
            {t('order.schedule')}
          </h2>
          {schedules.map((schedule) => (
            <PriceSchedule key={schedule.sku} schedule={schedule} locale={locale} />
          ))}
        </section>
      ) : null}

      {plans.length > 0 ? (
        <section aria-labelledby="order-labels" className="flex flex-col gap-5">
          <h2 id="order-labels" className={H2}>
            {t('order.labels')}
          </h2>
          <PlanLabels plans={plans} />
        </section>
      ) : null}

      <section aria-labelledby="order-delivery" className="flex flex-col gap-3">
        <h2 id="order-delivery" className={H2}>
          {t('order.delivery')}
        </h2>
        {address ? (
          <address className="m-0 flex flex-col text-md not-italic">
            {address.name ? <span className="font-display font-semibold">{address.name}</span> : null}
            <span>{address.line1}</span>
            {address.line2 ? <span>{address.line2}</span> : null}
            <span>{[address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ')}</span>
          </address>
        ) : (
          <p className="m-0 text-md">{t('order.noAddress')}</p>
        )}
        <p className="m-0 flex items-center gap-3 text-md">
          <span className="font-display font-semibold">{t('order.deliveryStatus')}</span>
          <OrderStatusTag status={order.status} />
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3" data-print="hide">
        {order.status === 'cancelled' ? null : <ReorderButton orderNumber={order.orderNumber} />}
        <PrintReceiptButton />
        <OrderActions order={order} />
      </div>
    </div>
  );
}
