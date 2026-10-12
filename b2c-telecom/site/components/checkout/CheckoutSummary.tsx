import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import { summaryRows, type SummaryRowId } from '@/lib/pricing/summary';
import type { CheckoutReview, Locale, Money } from '@/lib/types';

const LABEL_OF: Record<SummaryRowId, string> = { plans: 'plans', addons: 'addons', devices: 'devices', oneTime: 'oneTime', orderDiscount: 'discounts', shipping: 'shipping', tax: 'tax' };

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
  return (
    <div className="flex flex-col gap-4">
      {summaryRows(summary).map((row) => (
        <Row key={row.id} label={t(LABEL_OF[row.id])} value={fmt(row.amount)} muted={row.id === 'oneTime'} />
      ))}
      <div className="border-t border-border pt-4">
        <Row label={t('dueToday')} value={fmt(summary.dueToday)} strong />
      </div>
      {summary.taxAdded === null && (state.tax ?? summary.tax) && (state.tax ?? summary.tax)!.centAmount > 0 ? (
        <p className="m-0 text-sm text-text-muted">{t('taxIncluded', { amount: fmt((state.tax ?? summary.tax) as Money) })}</p>
      ) : null}
      {review.monthlyAfterToday.centAmount > 0 ? <Row label={t('monthly')} value={fmt(review.monthlyAfterToday)} muted /> : null}
      {summary.discountTotal.centAmount > 0 ? <Row label={t('save')} value={fmt(summary.discountTotal)} muted /> : null}
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
        <summary className="cursor-pointer font-display text-md font-bold">{t('toggle', { total: formatMoneyExact(review.state.cart.summary.dueToday, locale) })}</summary>
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
