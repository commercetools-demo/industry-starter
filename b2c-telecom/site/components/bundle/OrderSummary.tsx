'use client';

import type { ReactElement, ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { Cart, Locale, Money } from '@/lib/types';

type OrderSummaryProps = {
  cart: Cart;
  signedIn: boolean;
  /** The discount code form (kept out of here so the summary stays presentational). */
  codeForm?: ReactNode;
  /** The "save my bundle" action of workstream T (renders nothing in M). */
  extra?: ReactNode;
};

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }): ReactElement {
  return (
    <div className={cx('flex justify-between gap-4', strong ? 'font-display text-2xl font-bold' : muted ? 'text-sm text-text-muted' : 'text-md')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Every figure is the server's (`cart.summary`); nothing is added up here. */
export function OrderSummary({ cart, signedIn, codeForm, extra }: OrderSummaryProps): ReactElement {
  const t = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const fmt = (money: Money): string => formatMoneyExact(money, locale);
  const { summary } = cart;
  const shortfall = cart.minimumOrder?.shortfall ?? null;
  const negative = (money: Money): Money => ({ ...money, centAmount: -money.centAmount });

  return (
    <aside aria-label={t('summary.title')} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-7 lg:sticky lg:top-24">
      <h2 className="m-0 font-display text-xl font-bold tracking-ui">{t('summary.title')}</h2>
      {summary.plans.centAmount > 0 ? <Row label={t('summary.plans')} value={fmt(summary.plans)} /> : null}
      {summary.addons.centAmount > 0 ? <Row label={t('summary.addons')} value={fmt(summary.addons)} /> : null}
      {summary.devicesMonthly.centAmount > 0 ? <Row label={t('summary.devices')} value={fmt(summary.devicesMonthly)} /> : null}
      <div className="border-t border-border pt-4">
        <Row label={t('summary.monthly')} value={fmt(summary.monthly)} strong />
      </div>
      {summary.oneTime.centAmount > 0 ? <Row label={t('summary.oneTime')} value={fmt(summary.oneTime)} muted /> : null}
      {summary.discountTotal.centAmount > 0 ? <Row label={t('summary.discounts')} value={fmt(negative(summary.discountTotal))} /> : null}
      {summary.tax ? <Row label={t('summary.tax')} value={fmt(summary.tax)} /> : null}
      <div className="border-t border-border pt-4">
        <Row label={t('summary.dueToday')} value={fmt(summary.total)} strong />
      </div>
      {codeForm}
      {shortfall && cart.minimumOrder ? (
        <p role="status" className="m-0 text-sm font-semibold">
          {t('minimum', { shortfall: fmt(shortfall), minimum: fmt(cart.minimumOrder.required) })}
        </p>
      ) : null}
      {cart.canCheckout ? (
        <Button href="/bundle/checkout" block>
          {t('cta.checkout')}
        </Button>
      ) : (
        <span
          role="link"
          aria-disabled="true"
          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-pill bg-action px-6 text-center font-cta text-md font-extrabold text-text-on-pink opacity-50"
        >
          {t('cta.blocked')}
        </span>
      )}
      {!signedIn ? (
        <Link href="/login?next=%2Fbundle" className={cx('text-center font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
          {t('cta.login')}
        </Link>
      ) : null}
      {extra}
      <p className="m-0 text-sm text-text-muted">{t('summary.taxNote')}</p>
    </aside>
  );
}
