import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/utils';
import { TenderLines } from './TenderLines';
import type { Cart, Money } from '@/lib/types';

const useFormat = () => {
  const locale = useLocale();
  return (money: Money) => formatMoney(money.centAmount, money.currencyCode, locale);
};

/**
 * Order summary. Every figure is the platform's: the subtotal from the line totals it calculated, the delivery row
 * from the cart's shipping info (a zero price shows as FREE), the total from `cart.totalPrice`. Checkout is
 * disabled, with the reason, while any line cannot be dispensed.
 */
export function CartSummaryCard({ cart }: { cart: Cart }) {
  const t = useTranslations('cart');
  const money = useFormat();
  const tf = useTranslations('funding');
  const blocked = cart.unavailableCount > 0;
  const unresolved = cart.unresolved === true;
  return (
    <Card as="aside" className="grid content-start gap-3" aria-labelledby="cart-summary-title" data-cart-summary>
      <h2 id="cart-summary-title" className="font-display text-xl font-semibold text-navy-900">
        {t('summary')}
      </h2>
      {unresolved ? (
        <p className="rounded-md bg-warning-50 px-3.5 py-2.5 text-sm font-medium text-warning-700" role="status" data-cover-unresolved>
          {tf('unresolvedNote')}
        </p>
      ) : null}
      {cart.subtotal && !unresolved ? (
        <div className="flex items-center justify-between">
          <span>{t('subtotal')}</span>
          <b data-subtotal>{money(cart.subtotal)}</b>
        </div>
      ) : null}
      {cart.shipping && !unresolved ? (
        <div className="flex items-center justify-between">
          <span>{t('delivery')}</span>
          {cart.shipping.price.centAmount === 0 ? (
            <Badge variant="ok" data-delivery="free">
              {t('free')}
            </Badge>
          ) : (
            <b data-delivery="fee">{money(cart.shipping.price)}</b>
          )}
        </div>
      ) : null}
      {cart.planCovers && !unresolved ? (
        <div className="flex items-center justify-between" data-plan-covers>
          <span>{tf('planCovers')}</span>
          <b>{money(cart.planCovers)}</b>
        </div>
      ) : null}
      {unresolved ? null : (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <b>{cart.youOwe ? tf('youOwe') : t('total')}</b>
          <b className="text-xl text-navy-700" data-total>
            {money(cart.total)}
          </b>
        </div>
      )}
      {cart.tender && !unresolved ? <TenderLines tender={cart.tender} /> : null}
      {blocked ? (
        <p id="cart-blocked" className="text-sm text-danger-700" data-unavailable-note>
          {t('notIncluded', { count: cart.unavailableCount })}
        </p>
      ) : null}
      {unresolved ? (
        <Button full disabled data-checkout="unresolved">
          {tf('unresolvedButton')}
        </Button>
      ) : blocked ? (
        <Button full disabled aria-describedby="cart-blocked" data-checkout="blocked">
          {t('fixItems', { count: cart.unavailableCount })}
        </Button>
      ) : (
        <ButtonLink href="/checkout" full data-checkout="ready">
          {t('checkout')}
        </ButtonLink>
      )}
    </Card>
  );
}
