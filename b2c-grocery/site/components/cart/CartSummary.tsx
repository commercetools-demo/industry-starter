'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { checkoutBlock, isSlotActive } from '@/lib/cart-rules';
import type { Cart } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { ProvisionalNotice } from './ProvisionalNotice';
import { dayLabel, windowLabel } from './SlotPicker';

/**
 * Sticky summary. Every amount is the server cart's value; nothing is recomputed here.
 * Checkout needs `canCheckout(cart)` (address, slot, stock, Q) and an `onCheckout` handler.
 */
export function CartSummary({ cart, onCheckout }: { cart: Cart; onCheckout?: () => void }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const block = checkoutBlock(cart);
  const slot = isSlotActive(cart.slot) ? cart.slot : undefined;
  const explanation = {
    EMPTY: t('checkoutDisabled'),
    OUT_OF_STOCK: t('checkoutBlocked'),
    NO_ADDRESS: t('addAddress'),
    UNDELIVERABLE: t('step.undeliverable'),
    NO_SLOT: t('chooseSlot'),
  };
  const note = block ? explanation[block] : onCheckout ? null : t('checkoutDisabled');
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
      {slot ? (
        <p className="m-0 text-[13px] text-muted">{t('slotLine', { day: dayLabel(slot.start.slice(0, 10), locale), time: windowLabel(slot) })}</p>
      ) : null}
      <ProvisionalNotice cart={cart} />
      <hr className="m-0 border-0 border-t border-divider" />
      <div className="flex items-baseline justify-between font-heading text-[24px]">
        {cart.isProvisional ? <ProvisionalNotice cart={cart} variant="total" /> : <span>{t('total')}</span>}
        <span>{money(cart.total)}</span>
      </div>
      <Button block disabled={block !== null || !onCheckout} onClick={onCheckout} aria-describedby={note ? 'cart-checkout-note' : undefined} className="text-[15px]">
        {t('checkout')}
      </Button>
      {note ? (
        <p id="cart-checkout-note" className="m-0 text-[13px] text-muted">
          {note}
        </p>
      ) : null}
      <p className="m-0 text-[13px] text-muted">{t('returnsNote')}</p>
    </Card>
  );
}
