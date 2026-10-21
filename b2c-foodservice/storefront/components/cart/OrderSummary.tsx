'use client';

import { useTranslations } from 'next-intl';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';
import { taxLabel } from '@/lib/cart/summary';
import type { Cart } from '@/lib/types';
import AppliedCodes from './AppliedCodes';
import { blockerKey } from './CartDrawer';
import DiscountCodeForm from './DiscountCodeForm';
import GiftNotePrompt from './GiftNotePrompt';
import { useMoney, type CartUi } from './use-cart-ui';

function Row({ label, value, tone }: { label: string; value: string; tone?: 'discount' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`m-0 ${tone === 'discount' ? 'text-teal-text' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

/**
 * Order summary (sticky beside the lines on wide screens). Every figure is the engine's: subtotal and discount are display
 * sums of the engine's line fields, shipping, tax and total are read verbatim. Tax reads "Estimated tax" for net prices
 * (US and Canada) and "Includes {tax} tax" only when the rate is included in the price. Below the minimum order value the
 * Checkout button is not rendered and the shortfall is stated.
 */
export default function OrderSummary({ cart, ui }: { cart: Cart; ui: CartUi }) {
  const t = useTranslations('cart');
  const money = useMoney();
  const belowMinimum = cart.blockers.includes('below-minimum') && cart.minimumOrder.shortfall && cart.minimumOrder.value;
  const reason = blockerKey(cart);
  const blocked = !cart.canCheckout;
  const tax = taxLabel(cart.tax);

  return (
    <aside aria-labelledby="order-summary-title" className="rounded-card border border-line bg-surface p-6 stack:sticky stack:top-24">
      <h2 id="order-summary-title" className="m-0 mb-4 font-display text-[18px] font-bold">
        {t('summary.title')}
      </h2>
      <dl className="m-0 flex flex-col gap-2.5">
        <Row label={t('summary.subtotal')} value={money(cart.subtotal)} />
        {cart.discount ? <Row label={t('summary.discount')} value={`-${money(cart.discount)}`} tone="discount" /> : null}
        <Row
          label={t('summary.shipping')}
          value={cart.shipping ? (cart.shipping.isFree ? t('summary.shippingFree') : money(cart.shipping.amount)) : t('summary.shippingLater')}
        />
        {tax === 'included' && cart.tax ? (
          <Row label={t('summary.taxIncluded', { tax: money(cart.tax.amount) })} value="" />
        ) : (
          <Row label={t('summary.taxEstimated')} value={cart.tax ? money(cart.tax.amount) : t('summary.taxLater')} />
        )}
      </dl>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-4 font-display text-[17px] font-bold">
        <span>{t('summary.total')}</span>
        <span data-testid="order-total">{money(cart.total)}</span>
      </div>

      <DiscountCodeForm ui={ui} />
      <AppliedCodes cart={cart} ui={ui} />

      <div className="mt-5">
        {belowMinimum ? (
          <p role="status" className="m-0 rounded-field bg-amber/25 px-4 py-3 text-[13.5px] text-ink">
            {t('minimum.shortfall', { shortfall: money(cart.minimumOrder.shortfall!), minimum: money(cart.minimumOrder.value!) })}
          </p>
        ) : (
          <>
            <ButtonLink
              href="/checkout"
              size="lg"
              block
              aria-disabled={blocked || undefined}
              onClick={(e) => {
                if (blocked) e.preventDefault();
              }}
            >
              {t('summary.checkout')}
            </ButtonLink>
            {blocked && reason ? (
              <p role="status" className="m-0 mt-2 text-center text-[12.5px] text-ink-3">
                {t(`blocker.${reason}`)}
              </p>
            ) : null}
          </>
        )}
      </div>
      <p className="m-0 mt-3 flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
        <Icon name="shield" size={14} />
        {t('summary.secure')}
      </p>
      <GiftNotePrompt />
    </aside>
  );
}
