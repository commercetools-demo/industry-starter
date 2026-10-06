'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FinalAmount } from '@/components/cart/FinalAmount';
import { ProvisionalNotice } from '@/components/cart/ProvisionalNotice';
import { dayLabel, windowLabel } from '@/components/cart/SlotPicker';
import { PriceBlock } from '@/components/product/PriceBlock';
import { Button } from '@/components/ui/Button';
import { Card, CardKicker } from '@/components/ui/Card';
import { Photo } from '@/components/ui/Photo';
import { Table } from '@/components/ui/Table';
import { useOrder } from '@/hooks/useOrders';
import type { Money, Order } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { addressLines } from './AddressCard';
import { formatDate, orderLabel } from './format';
import { OrderStatusTag } from './OrderStatusTag';
import { LineRemovalTag, OrderSubstitutions } from './OrderSubstitutions';

function OrderNotFound() {
  const t = useTranslations('account.order');
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      <div className="flex flex-col items-start gap-(--space-3)" data-testid="order-not-found">
        <h1 className="m-0 text-[42px]">{t('notFoundTitle')}</h1>
        <p className="m-0 text-[17px] text-text/60">{t('notFoundBody')}</p>
        <Button href="/account/orders">{t('back')}</Button>
      </div>
    </div>
  );
}

function Totals({ order }: { order: Order }) {
  const t = useTranslations('account.order');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  return (
    <Card elev="sm" className="gap-(--space-3) p-[17.6px]" aria-labelledby="order-totals-title">
      <CardKicker>
        <span id="order-totals-title">{t('totals')}</span>
      </CardKicker>
      <dl className="m-0 flex flex-col gap-(--space-2) text-[15px]">
        <div className="flex justify-between">
          <dt>{t('subtotal')}</dt>
          <dd className="m-0">{money(order.subtotal)}</dd>
        </div>
        {order.shipping ? (
          <div className="flex justify-between">
            <dt>{t('shipping')}</dt>
            <dd className="m-0">{order.shipping.centAmount === 0 ? t('shippingFree') : money(order.shipping)}</dd>
          </div>
        ) : null}
        {order.tax ? (
          <div className="flex justify-between text-text/60">
            <dt>{t('tax')}</dt>
            <dd className="m-0">{money(order.tax)}</dd>
          </div>
        ) : null}
      </dl>
      {order.isProvisional ? <ProvisionalNotice variant="inline" /> : null}
      <hr className="m-0 border-0 border-t border-divider" />
      <div className="flex items-baseline justify-between font-heading text-[22px]">
        {order.isProvisional ? <ProvisionalNotice variant="total" /> : <span>{t('total')}</span>}
        <span>{money(order.total)}</span>
      </div>
      <FinalAmount provisional={order.total} final={order.finalTotal} />
    </Card>
  );
}

/** Order detail (client-fetched; the API answers 404 for an order that is not the signed-in customer's). */
export function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations('account.order');
  const tAccount = useTranslations('account');
  const locale = useLocale();
  const { order, notFound, error, isLoading, mutate } = useOrder(orderId);

  if (notFound) return <OrderNotFound />;
  const shell = (children: ReactNode) => <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">{children}</div>;
  if (!order) {
    if (error) {
      return shell(
        <div role="alert" className="flex flex-col items-start gap-(--space-3)">
          <p className="m-0 text-[15px]">{tAccount('loadFailed')}</p>
          <Button variant="secondary" onClick={() => void mutate()}>
            {tAccount('retry')}
          </Button>
        </div>,
      );
    }
    return shell(
      <p aria-busy={isLoading} className="m-0 text-[15px] text-text/60">
        {t('loading')}
      </p>,
    );
  }

  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  return shell(
    <>
      <Button href="/account/orders" variant="ghost" className="mb-(--space-3)">
        {t('back')}
      </Button>
      <h6 className="text-accent-700">{t('placed', { date: formatDate(order.createdAt, locale) })}</h6>
      <div className="mb-(--space-2) flex flex-wrap items-center gap-(--space-3)">
        <h1 className="m-0 text-[52px]">{t('title', { number: orderLabel(order) })}</h1>
        <OrderStatusTag status={order.status} />
      </div>
      {order.slot ? (
        <p className="mb-(--space-6) text-[15px]" data-testid="order-slot">
          {t('delivery', { day: dayLabel(order.slot.start.slice(0, 10), locale), time: windowLabel(order.slot) })}
        </p>
      ) : (
        <div className="mb-(--space-6)" />
      )}
      <div className="grid items-start gap-[42px] desktop:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-(--space-4)">
          <OrderSubstitutions order={order} />
          <Table
            caption={t('itemsCaption')}
            columns={[t('colItem'), t('colQuantity'), t('colUnitPrice'), t('colTotal'), t('colSubstitution')]}
            className="[&_td:nth-child(n+3):nth-child(-n+4)]:text-right [&_th:nth-child(n+3):nth-child(-n+4)]:text-right"
          >
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <div className="flex items-center gap-(--space-3)">
                    <Photo src={line.image ?? ''} alt="" sizes="64px" className="h-[64px] w-[64px] flex-none" />
                    <div>
                      <div className="text-[15px]">{line.name}</div>
                      {line.increment.label ? <div className="card-meta">{line.increment.label}</div> : null}
                      {line.substitute ? <div className="card-meta">{line.substitute.name}</div> : null}
                      <LineRemovalTag orderId={order.id} lineId={line.id} />
                    </div>
                  </div>
                </td>
                <td>{line.quantity}</td>
                <td>
                  <PriceBlock price={line.unitPrice} increment={line.increment} />
                </td>
                <td>{money(line.total)}</td>
                <td>{t(`preference.${line.substitutionPreference}`)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <aside className="flex flex-col gap-(--space-4)">
          <Totals order={order} />
          {order.shippingAddress ? (
            <Card elev="sm" className="p-[17.6px]" aria-labelledby="order-address-title">
              <CardKicker>
                <span id="order-address-title">{t('address')}</span>
              </CardKicker>
              <address className="m-0 text-[15px] not-italic leading-[1.6]">
                {addressLines(order.shippingAddress).map((line, i) => (
                  <div key={`${i}-${line}`}>{line}</div>
                ))}
              </address>
            </Card>
          ) : null}
        </aside>
      </div>
    </>,
  );
}
