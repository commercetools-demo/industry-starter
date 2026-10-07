import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { CheckoutReview, Locale, Money } from '@/lib/types';

// Junior design choice (D-068): the checkout summary is the cart's "Order summary" (design/specs/cart.md) without the discount-code form
// and the CTA. Every figure is a projection of the last cart response: nothing is added up here.

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }): ReactElement {
  return (
    <div className={cx('flex justify-between gap-4', strong ? 'font-display text-2xl font-bold' : muted ? 'text-sm text-text-muted' : 'text-md')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Rows({ review }: { review: CheckoutReview }): ReactElement {
  const t = useTranslations('checkout.summary');
  const locale = useLocale() as Locale;
  const fmt = (money: Money): string => formatMoneyExact(money, locale);
  const { state } = review;
  const { summary } = state.cart;
  const zero: Money = { centAmount: 0, currencyCode: state.cart.currencyCode };
  const negative = (money: Money): Money => ({ ...money, centAmount: -money.centAmount });
  return (
    <div className="flex flex-col gap-4">
      {summary.plans.centAmount > 0 ? <Row label={t('plans')} value={fmt(summary.plans)} /> : null}
      {summary.addons.centAmount > 0 ? <Row label={t('addons')} value={fmt(summary.addons)} /> : null}
      {summary.devicesMonthly.centAmount > 0 ? <Row label={t('devices')} value={fmt(summary.devicesMonthly)} /> : null}
      {summary.oneTime.centAmount > 0 ? <Row label={t('oneTime')} value={fmt(summary.oneTime)} muted /> : null}
      {summary.discountTotal.centAmount > 0 ? <Row label={t('discounts')} value={fmt(negative(summary.discountTotal))} /> : null}
      {state.shipping ? <Row label={t('shipping')} value={fmt(state.shipping)} /> : null}
      <Row label={t('tax')} value={fmt(state.tax ?? summary.tax ?? zero)} />
      <div className="border-t border-border pt-4">
        <Row label={t('dueToday')} value={fmt(summary.total)} strong />
      </div>
      {review.monthlyAfterToday.centAmount > 0 ? <Row label={t('monthly')} value={fmt(review.monthlyAfterToday)} muted /> : null}
      {review.contractTotal ? <Row label={t('contractTotal')} value={fmt(review.contractTotal)} muted /> : null}
    </div>
  );
}

/**
 * Sticky 320 px summary beside the steps; under 768 px it is a collapsed `<details>` above them ("Order summary · {total}").
 */
export function CheckoutSummary({ review }: { review: CheckoutReview }): ReactElement {
  const t = useTranslations('checkout.summary');
  const locale = useLocale() as Locale;
  return (
    <>
      <details className="rounded-xl border border-border bg-surface p-5 md:hidden">
        <summary className="cursor-pointer font-display text-md font-bold">{t('toggle', { total: formatMoneyExact(review.state.cart.summary.total, locale) })}</summary>
        <div className="pt-4">
          <Rows review={review} />
        </div>
      </details>
      <aside aria-label={t('title')} className="hidden flex-col gap-4 rounded-xl border border-border bg-surface p-7 md:flex md:sticky md:top-24 md:w-80 md:shrink-0 md:self-start">
        <h2 className="m-0 font-display text-xl font-bold tracking-ui">{t('title')}</h2>
        <Rows review={review} />
      </aside>
    </>
  );
}
