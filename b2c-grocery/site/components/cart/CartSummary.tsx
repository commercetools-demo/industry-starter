'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Cart } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { ProvisionalNotice } from './ProvisionalNotice';

/**
 * Sticky summary. Every amount is the server cart's value; nothing is recomputed here.
 * Checkout stays disabled in J (workstream V enables it) and also whenever a line is out of stock.
 */
export function CartSummary({ cart }: { cart: Cart }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const hasUnavailable = cart.lines.some((l) => !l.inStock);
  return (
    <Card elev="md" className="gap-(--space-3) p-[26px] desktop:sticky desktop:top-[110px]" aria-labelledby="cart-summary-title">
      <h3 id="cart-summary-title" className="m-0 text-[24px]">
        {t('summary')}
      </h3>
      <dl className="m-0 flex flex-col gap-(--space-2) text-[15px]">
        <div className="flex justify-between">
          <dt>{t('subtotal')}</dt>
          <dd className="m-0">{money(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t('delivery')}</dt>
          <dd className="m-0">{cart.shipping ? (cart.shipping.free ? t('deliveryIncluded') : money(cart.shipping.price)) : t('deliveryPending')}</dd>
        </div>
      </dl>
      <ProvisionalNotice cart={cart} />
      <hr className="m-0 border-0 border-t border-divider" />
      <div className="flex items-baseline justify-between font-heading text-[24px]">
        <span>{t('total')}</span>
        <span>{money(cart.total)}</span>
      </div>
      <Button block disabled aria-describedby="cart-checkout-note" className="text-[15px]">
        {t('checkout')}
      </Button>
      <p id="cart-checkout-note" className="m-0 text-[13px] text-muted">
        {hasUnavailable ? t('checkoutBlocked') : t('checkoutDisabled')}
      </p>
      <p className="m-0 text-[13px] text-muted">{t('returnsNote')}</p>
    </Card>
  );
}
