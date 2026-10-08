import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { TenderLines } from '@/components/cart/TenderLines';
import { formatMoney, getLocalizedString } from '@/lib/utils';
import type { CheckoutCart, Money } from '@/lib/types';

/**
 * Order summary. A projection of the last cart the server returned: every line total, the delivery row (FREE badge
 * or the fee), tax when the platform charged any, and the Total (navy, 20 px, bold) are the platform's figures;
 * nothing here adds or recomputes a price (the AST test of the cart components covers this folder too). Sticky at
 * 96 px from the top beside the cards; it stacks below them under 900 px (the `nav` breakpoint).
 */
export function OrderSummary({ cart, children }: { cart: CheckoutCart; /** The Place order button and its notes. */ children?: ReactNode }) {
  const t = useTranslations('checkout.summary');
  const tf = useTranslations('funding');
  const locale = useLocale();
  const unresolved = cart.unresolved === true;
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  return (
    <Card as="aside" aria-labelledby="checkout-summary-title" className="grid content-start gap-3 nav:sticky nav:top-24" data-checkout-summary>
      <h2 id="checkout-summary-title" className="font-display text-xl font-semibold text-navy-900">
        {t('title')}
      </h2>
      <ul aria-label={t('lines')} className="grid gap-2">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3" data-summary-line>
            <span>
              <span className={line.unavailable ? 'text-neutral-500 line-through' : undefined}>{getLocalizedString(line.name, locale)}</span>
              <span className="block text-sm text-neutral-600">{t('qty', { count: line.prescribedQty })}</span>
            </span>
            {line.cover === 'unresolved' ? (
              <span className="text-right text-sm font-medium text-warning-700" data-cover="unresolved">
                {tf('unresolved')}
              </span>
            ) : line.youOwe && line.coveredAmount ? (
              <span className="grid justify-items-end text-right" data-cover-figure={line.cover}>
                <b>{money(line.youOwe)}</b>
                <span className="text-sm text-neutral-600">{line.cover === 'not-covered' ? tf('notCovered') : tf('linePlanCovers', { amount: money(line.coveredAmount) })}</span>
              </span>
            ) : (
              <b>{money(line.totalPrice)}</b>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span>{t('delivery')}</span>
        {cart.shipping ? (
          cart.shipping.price.centAmount === 0 ? (
            <Badge variant="ok" data-delivery="free">
              {t('free')}
            </Badge>
          ) : (
            <b data-delivery="fee">{money(cart.shipping.price)}</b>
          )
        ) : (
          <span className="text-neutral-600">—</span>
        )}
      </div>
      {cart.tax && cart.tax.centAmount > 0 ? (
        <div className="flex items-center justify-between">
          <span>{t('tax')}</span>
          <b data-tax>{money(cart.tax)}</b>
        </div>
      ) : null}
      {cart.planCovers && !unresolved ? (
        <div className="flex items-center justify-between" data-plan-covers>
          <span>{tf('planCovers')}</span>
          <b>{money(cart.planCovers)}</b>
        </div>
      ) : null}
      {unresolved ? (
        <p className="rounded-md bg-warning-50 px-3.5 py-2.5 text-sm font-medium text-warning-700" role="status" data-cover-unresolved>
          {tf('unresolvedNote')}
        </p>
      ) : (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <b>{cart.youOwe ? tf('youOwe') : t('total')}</b>
          <b className="text-xl text-navy-700" data-total>
            {money(cart.total)}
          </b>
        </div>
      )}
      {cart.tender && !unresolved ? <TenderLines tender={cart.tender} /> : null}
      {children}
    </Card>
  );
}
