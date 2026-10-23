'use client';

import { useLocale, useTranslations } from 'next-intl';
import LineImage from '@/components/cart/LineImage';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import type { OrderLineView, OrderView } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

function Marker({ line, stores }: { line: OrderLineView; stores: Map<string, string> }) {
  const t = useTranslations('checkout.cluster');
  const text =
    line.fulfilment === 'collect' ? t('lineCollect', { store: stores.get(line.storeKey ?? '') ?? '' }) : line.fulfilment === 'subscribe' ? t('subscribe') : t('lineDelivery');
  const icon = line.fulfilment === 'collect' ? 'store' : line.fulfilment === 'subscribe' ? 'repeat' : 'truck';
  return (
    <span data-fulfilment={line.fulfilment} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
      <Icon name={icon} size={14} />
      {text}
    </span>
  );
}

/** The items card: every line with its fulfilment marker, then the order's own totals (not the cart's). */
export default function OrderItems({ order }: { order: OrderView }) {
  const t = useTranslations('order');
  const locale = useLocale();
  const money = (cents: number) => formatMoney(cents, order.currency, locale);
  const stores = new Map(order.collect.map((c) => [c.storeKey, c.storeName]));
  const { totals } = order;
  return (
    <Card as="section" aria-labelledby="order-items-title" data-testid="order-items">
      <h2 id="order-items-title" className="m-0 mb-2 font-display text-[17px] font-semibold">
        {t('items')}
      </h2>
      <ul className="m-0 list-none p-0">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-start gap-3.5 border-t border-line py-3 first:border-t-0">
            <LineImage {...(l.imageUrl ? { url: l.imageUrl } : {})} alt={l.name} width={48} height={58} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] font-semibold text-ink">{l.name}</p>
              <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">{[l.variantSummary, t('line.quantity', { quantity: l.quantity })].filter(Boolean).join(' · ')}</p>
              <Marker line={l} stores={stores} />
            </div>
            <span className="shrink-0 text-[14px] font-semibold">{money(l.priceCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="m-0 mt-2 flex flex-col gap-2 border-t border-line pt-3 text-[13.5px]">
        <div className="flex justify-between"><dt className="text-ink-2">{t('summary.subtotal')}</dt><dd className="m-0">{money(totals.subtotalCents)}</dd></div>
        {totals.discountCents > 0 ? <div className="flex justify-between"><dt className="text-ink-2">{t('summary.discount')}</dt><dd className="m-0 text-teal-text">-{money(totals.discountCents)}</dd></div> : null}
        <div className="flex justify-between"><dt className="text-ink-2">{t('summary.shipping')}</dt><dd className="m-0">{money(totals.shippingCents)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">{t('summary.tax')}</dt><dd className="m-0">{money(totals.taxCents)}</dd></div>
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 font-display text-[16px] font-bold">
        <span>{t('total')}</span>
        <span data-testid="order-total">{money(totals.totalCents)}</span>
      </div>
    </Card>
  );
}
