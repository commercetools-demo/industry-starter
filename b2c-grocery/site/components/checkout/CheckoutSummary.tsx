'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ProvisionalNotice } from '@/components/cart/ProvisionalNotice';
import { dayLabel, windowLabel } from '@/components/cart/SlotPicker';
import { Card } from '@/components/ui/Card';
import { Photo } from '@/components/ui/Photo';
import type { Cart, Money } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** Compact read-only summary next to the hosted checkout. Every amount is the server cart's value. */
export function CheckoutSummary({ cart }: { cart: Cart }) {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  return (
    <Card elev="md" className="gap-(--space-3) p-[26px] desktop:sticky desktop:top-[110px]" aria-labelledby="checkout-summary-title">
      <h2 id="checkout-summary-title" className="m-0 text-[24px]">
        {t('summaryTitle', { count: cart.lines.length })}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-(--space-3) p-0">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-(--space-3) text-[14px]">
            <Photo src={line.image ?? ''} alt="" sizes="52px" className="h-[62px] w-[52px] flex-none" />
            <span className="min-w-0 flex-1">
              {line.name} <span className="text-muted">× {line.quantity}</span>
            </span>
            <span className="flex-none">{money(line.total)}</span>
          </li>
        ))}
      </ul>
      <hr className="m-0 border-0 border-t border-divider" />
      <dl className="m-0 flex flex-col gap-(--space-2) text-[15px]">
        <div className="flex justify-between">
          <dt>{tCart('subtotal')}</dt>
          <dd className="m-0">{money(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{tCart('delivery')}</dt>
          <dd className="m-0">{cart.shipping ? (cart.shipping.free ? tCart('deliveryIncluded') : money(cart.shipping.price)) : tCart('deliveryPending')}</dd>
        </div>
      </dl>
      {cart.slot ? (
        <p className="m-0 text-[13px] text-muted" data-testid="checkout-slot">
          {tCart('slotLine', { day: dayLabel(cart.slot.start.slice(0, 10), locale), time: windowLabel(cart.slot) })}
        </p>
      ) : null}
      <ProvisionalNotice cart={cart} />
      <hr className="m-0 border-0 border-t border-divider" />
      <div className="flex items-baseline justify-between font-heading text-[24px]">
        {cart.isProvisional ? <ProvisionalNotice cart={cart} variant="total" /> : <span>{tCart('total')}</span>}
        <span>{money(cart.total)}</span>
      </div>
    </Card>
  );
}
