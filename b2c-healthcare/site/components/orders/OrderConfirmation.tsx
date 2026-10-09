import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Instrument, OrderView } from '@/lib/order-types';
import type { Money } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { CancelOrder } from './CancelOrder';
import { OrderTimeline } from './OrderTimeline';

/**
 * `/order/<id>`: one card (design-checkout: Order confirmation and tracking). Everything comes from the order itself,
 * never from the cart: the badge and headline follow the State ("Order placed" becomes "Order cancelled" for a
 * cancelled order), the timeline is driven by the State, shipment and refund come from `shipmentState` and the
 * Payment's transactions. Estimate: "Today by 8 pm" for same-day, else "1-2 business days"; it is not shown once the
 * order is delivered or cancelled.
 */
export function OrderConfirmation({ order, allowanceBalance }: { order: OrderView; /** The member's allowance balance now, when this order drew from it (workstream U). */ allowanceBalance?: Money | null }) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const cancelled = order.status === 'cancelled';
  const showEstimate = !cancelled && order.status !== 'delivered';
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  const recorded = order.lines.some((l) => l.eligible !== undefined);
  return (
    <main>
      <div className="mx-auto max-w-160 px-5 py-12 nav:px-8">
        <Card className="grid gap-4" data-order-status={order.status}>
          <Badge variant={cancelled ? 'no' : 'ok'} className="justify-self-start">
            {cancelled ? t('cancelledBadge') : t('placed')}
          </Badge>
          <h1 className="font-display text-3xl font-semibold text-navy-900">{cancelled ? t('cancelledTitle') : t('title')}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-neutral-600">{t('rows.order')}</dt>
            <dd className="font-meta font-bold text-navy-900">{order.orderNumber}</dd>
            <dt className="text-neutral-600">{t('rows.items')}</dt>
            <dd>{order.lines.map((l) => l.name).join(', ')}</dd>
            {order.deliverTo ? (
              <>
                <dt className="text-neutral-600">{t('rows.deliverTo')}</dt>
                <dd>{order.deliverTo}</dd>
              </>
            ) : null}
            {showEstimate ? (
              <>
                <dt className="text-neutral-600">{t('rows.estimate')}</dt>
                <dd>{order.sameDay ? t('estimate.sameDay') : t('estimate.standard')}</dd>
              </>
            ) : null}
            {order.shipmentState && !cancelled ? (
              <>
                <dt className="text-neutral-600">{t('rows.shipment')}</dt>
                <dd data-shipment-state={order.shipmentState}>
                  <Badge variant={order.shipmentState === 'Delivered' || order.shipmentState === 'Shipped' ? 'ok' : 'wait'}>{t(`shipment.${order.shipmentState}`)}</Badge>
                </dd>
              </>
            ) : null}
            <dt className="text-neutral-600">{t('rows.total')}</dt>
            <dd className="font-bold text-navy-900">{formatMoney(order.total.centAmount, order.total.currencyCode, locale)}</dd>
          </dl>
          {order.tender || recorded ? (
            <section aria-label={t('tender.title')} className="grid gap-2 border-t border-border pt-3 text-sm" data-order-tender>
              <h2 className="font-display text-lg font-semibold text-navy-900">{t('tender.title')}</h2>
              {order.tender ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                  {order.tender.allowance.centAmount > 0 ? (
                    <>
                      <dt className="text-neutral-600">{t('tender.allowance')}</dt>
                      <dd data-tender-allowance>{money(order.tender.allowance)}</dd>
                    </>
                  ) : null}
                  {order.tender.restricted.centAmount > 0 ? (
                    <>
                      <dt className="text-neutral-600">{t('tender.restricted')}</dt>
                      <dd data-tender-restricted>{money(order.tender.restricted)}</dd>
                    </>
                  ) : null}
                  <dt className="text-neutral-600">{t('tender.card')}</dt>
                  <dd data-tender-card>{order.tender.card.centAmount === 0 ? t('tender.noCard') : money(order.tender.card)}</dd>
                  {allowanceBalance && order.tender.allowance.centAmount > 0 ? (
                    <>
                      <dt className="text-neutral-600">{t('tender.balance')}</dt>
                      <dd data-allowance-balance>{money(allowanceBalance)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
              {recorded ? (
                <ul className="grid gap-1" data-order-lines>
                  {order.lines.map((l, i) => (
                    <li key={`${l.name}-${i}`} data-eligible={l.eligible === undefined ? undefined : String(l.eligible)}>
                      <b>{l.name}</b>
                      {': '}
                      {l.eligible ? t('tender.qualifying') : t('tender.notQualifying')}
                      {l.settledBy && l.settledBy.length > 0 ? ` \u00b7 ${t('tender.settledBy', { instruments: l.settledBy.map((x: Instrument) => t(`tender.instrument.${x}`)).join(', ') })}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
          <OrderTimeline status={order.status} />
          {cancelled && order.refund !== 'none' ? (
            <p data-refund={order.refund} className="rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-info-700">
              {t(`refund.${order.refund}`)}
            </p>
          ) : null}
          {order.status === 'delivered' ? <p className="text-sm text-neutral-600">{t('returns')}</p> : null}
          {order.cancellable ? <CancelOrder orderId={order.id} /> : null}
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/account/orders">{t('myOrders')}</ButtonLink>
            <ButtonLink href="/prescriptions" variant="outline">
              {t('searchRx')}
            </ButtonLink>
          </div>
        </Card>
      </div>
    </main>
  );
}
