'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import PanelState from '@/components/account/PanelState';
import DeliveryList from '@/components/account/orders/DeliveryList';
import OrderNotFound from '@/components/account/orders/OrderNotFound';
import OrderStatusPill from '@/components/account/orders/OrderStatusPill';
import OrderStatusTracker from '@/components/account/orders/OrderStatusTracker';
import ReturnDialog from '@/components/account/orders/ReturnDialog';
import ReturnList from '@/components/account/orders/ReturnList';
import LineImage from '@/components/cart/LineImage';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/context/toast';
import { useOrder } from '@/hooks/useOrder';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { formatMoney } from '@/lib/utils';
import type { OrderDetailView } from '@/lib/types';

/** Order detail: breadcrumb, status, tracker, collection card, shipments, items, totals and returns. */
export default function OrderDetail({ orderNumber, initial }: { orderNumber: string; initial?: OrderDetailView | null }) {
  const t = useTranslations('account.orders');
  const tTabs = useTranslations('account.tabs');
  const { order, isLoading, isError, notFound, mutate } = useOrder(orderNumber, initial);
  const { startReturn } = useOrderActions();
  const toast = useToast();
  const [returning, setReturning] = useState(false);
  const locale = useLocale();
  const format = useFormatter();
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <section aria-labelledby="order-heading">
      <nav aria-label={t('breadcrumb')} className="mb-3 text-[13px] text-ink-3">
        <Link href="/account/orders" className="text-ink-2 underline underline-offset-2">
          {tTabs('orders')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{orderNumber}</span>
      </nav>
      {notFound && !order ? <OrderNotFound /> : null}
      <PanelState
        panel={tTabs('orders')}
        isLoading={isLoading && !order && !notFound}
        isError={isError && !order && !notFound}
        isEmpty={false}
        onRetry={() => void mutate()}
        empty={null}
      >
        {order ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="order-heading" className="m-0 font-mono text-[22px] font-bold text-ink" data-testid="order-number">
                  {order.orderNumber}
                </h2>
                <p className="m-0 mt-1 text-[12.5px] text-ink-3">
                  {t('placedOn', { date: format.dateTime(new Date(order.createdAt), { dateStyle: 'medium' }) })}
                </p>
              </div>
              <OrderStatusPill status={order.status} hasCollect={order.hasCollect} hasShip={order.hasShip} />
            </div>

            {order.hasCollect && order.status !== 'cancelled' ? (
              <Card className="mb-5">
                <OrderStatusTracker state={order.stateKey} />
              </Card>
            ) : null}

            {order.collect ? (
              <Card className="mb-5" data-testid="collection-card">
                <h3 className="m-0 mb-2 font-display text-[17px] font-bold text-ink">{t('detail.collection')}</h3>
                <p className="m-0 text-[14.5px] font-semibold text-ink">{order.collect.storeName}</p>
                {order.collect.addressLine ? <p className="m-0 text-[14px] text-ink-2">{order.collect.addressLine}</p> : null}
                {order.collect.hours ? <p className="m-0 text-[14px] text-ink-2">{order.collect.hours}</p> : null}
                {order.collect.phone ? <p className="m-0 text-[14px] text-ink-2">{order.collect.phone}</p> : null}
              </Card>
            ) : null}

            <DeliveryList deliveries={order.deliveries} />

            {order.shippingAddress ? (
              <Card className="mb-5" data-testid="shipping-address">
                <h3 className="m-0 mb-2 font-display text-[17px] font-bold text-ink">{t('detail.shippingAddress')}</h3>
                <p className="m-0 text-[14px] text-ink-2">
                  {order.shippingAddress.name}
                  <br />
                  {order.shippingAddress.line}
                  <br />
                  {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(' ')}
                </p>
              </Card>
            ) : null}

            <Card className="mb-5">
              <h3 className="m-0 mb-3 font-display text-[17px] font-bold text-ink">{t('detail.items')}</h3>
              <ul className="m-0 grid list-none gap-4 p-0">
                {order.lines.map((l) => (
                  <li key={l.id} className="flex gap-4" data-testid="order-line">
                    <LineImage url={l.imageUrl ?? undefined} alt="" width={52} height={62} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[14.5px] font-semibold text-ink">{l.name}</p>
                      <p className="m-0 text-[12.5px] text-ink-3">
                        {t('detail.quantity', { count: l.quantity })} · {t(`detail.fulfilment.${l.fulfilment}`)}
                        {l.storeName ? ` · ${l.storeName}` : ''}
                      </p>
                    </div>
                    <p className="m-0 text-[14px] font-semibold text-ink">{money(l.totalCents, order.currency)}</p>
                  </li>
                ))}
              </ul>
              <dl className="m-0 mt-5 grid gap-1.5 border-t border-line pt-4 text-[14px]">
                <Row label={t('detail.subtotal')} value={money(order.subtotalCents, order.currency)} />
                {order.shippingCents !== null ? <Row label={t('detail.shipping')} value={money(order.shippingCents, order.currency)} /> : null}
                {order.taxCents !== null ? <Row label={t('detail.tax')} value={money(order.taxCents, order.currency)} /> : null}
                <Row label={t('detail.total')} value={money(order.totalCents, order.currency)} strong />
              </dl>
            </Card>

            {order.returns.length > 0 || order.canReturn || returnClosed(order) ? (
              <section aria-labelledby="returns-heading" className="mb-5">
                <h3 id="returns-heading" className="m-0 mb-3 font-display text-[17px] font-bold text-ink">
                  {t('return.title2')}
                </h3>
                <ReturnList returns={order.returns} />
                {order.canReturn ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button variant="ghost" onClick={() => setReturning(true)}>
                      {t('return.start')}
                    </Button>
                    {order.returnWindowEndsAt ? (
                      <span className="text-[12.5px] text-ink-3">
                        {t('return.windowEnds', { date: format.dateTime(new Date(order.returnWindowEndsAt), { dateStyle: 'medium' }) })}
                      </span>
                    ) : null}
                  </div>
                ) : returnClosed(order) ? (
                  <p className="m-0 mt-3 text-[13.5px] text-ink-3" data-testid="return-closed">
                    {t('return.closed')}
                  </p>
                ) : null}
              </section>
            ) : null}
            <ReturnDialog
              order={order}
              open={returning}
              onClose={() => setReturning(false)}
              onSubmit={async (items) => {
                await startReturn(order, items);
                toast.show(t('return.started'));
              }}
            />
          </>
        ) : null}
      </PanelState>
    </section>
  );
}

/** A completed order that still has units to return but whose window has passed. */
function returnClosed(o: OrderDetailView): boolean {
  return o.status === 'completed' && !o.canReturn && Object.values(o.returnable).some((q) => q > 0);
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>
      <dt>{label}</dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}
