'use client';

import { useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PriceSchedule } from '@/components/bundle/PriceSchedule';
import { PolicyLink } from '@/components/content/PolicyLink';
import { AcquisitionSummary } from '@/components/devices/AcquisitionSummary';
import { FinancingDecisionNotice } from '@/components/devices/FinancingDecisionNotice';
import { BroadbandLabel } from '@/components/label/BroadbandLabel';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { CheckoutError } from '@/hooks/useCheckout';
import { Link, useRouter } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { lineQuote } from '@/lib/devices/acquisition';
import { formatDate } from '@/lib/account/format';
import { formatMoneyExact } from '@/lib/format';
import type { CartLine, CheckoutAddress, CheckoutSessionInfo, FinancingDecision, Locale, Money } from '@/lib/types';
import type { CheckoutApi } from './types';
import { TotalChangedNotice } from './TotalChangedNotice';
import { useCheckoutErrorText } from './useCheckoutError';

type Props = {
  checkout: CheckoutApi;
  /** Called with the started payment (a hosted session, or the demo marker) and the total it was started for. */
  onPayment: (info: CheckoutSessionInfo, totalCents: number) => void;
};

const H3 = 'm-0 font-display text-lg font-bold';
const LINK = cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING);

function AddressBlock({ title, address, change }: { title: string; address: CheckoutAddress; change: { href: string; label: string } }): ReactElement {
  return (
    <div className="flex flex-col gap-1 text-md">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="m-0 font-display text-sm font-semibold">{title}</h4>
        <Link href={change.href} className={LINK}>
          {change.label}
        </Link>
      </div>
      <span>
        {address.firstName} {address.lastName}
      </span>
      <span>
        {address.streetName}
        {address.additionalStreetInfo ? `, ${address.additionalStreetInfo}` : ''}
      </span>
      <span>
        {address.city}
        {address.state ? `, ${address.state}` : ''} {address.postalCode}
      </span>
    </div>
  );
}

const sameAddress = (a: CheckoutAddress, b: CheckoutAddress): boolean => a.streetName === b.streetName && a.postalCode === b.postalCode && a.city === b.city && a.firstName === b.firstName;

/**
 * Step 4: what the buyer is about to commit to. Plans show their price schedule and Broadband Facts label (M, L), devices their acquisition
 * summary and end-of-term notice (Q). Every figure is the cart's. "Continue to payment" needs the consent box; it asks the server to start
 * the payment with the total the buyer saw, and the server refuses (and says why) when anything moved.
 */
export function ReviewStep({ checkout, onPayment }: Props): ReactElement {
  const t = useTranslations('checkout');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useCheckoutErrorText();
  const { review } = checkout;
  const { state } = review;
  const { cart } = state;
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [changed, setChanged] = useState<{ old: Money; next: Money } | null>(null);
  const [declined, setDeclined] = useState<FinancingDecision | null>(null);
  const fmt = (money: Money): string => formatMoneyExact(money, locale);

  const plans = cart.lines.filter((line) => line.kind === 'plan');
  const devices = cart.lines.filter((line) => line.kind === 'device');
  const extras = cart.lines.filter((line) => line.kind === 'addon' || line.kind === 'equipment' || line.kind === 'fee');
  const priceOf = (line: CartLine): string => (line.chargeType === 'recurring' ? t('review.perMonth', { amount: fmt(line.total) }) : t('review.oneTime', { amount: fmt(line.total) }));

  async function pay(): Promise<void> {
    setBusy(true);
    setFailure(null);
    setChanged(null);
    setDeclined(null);
    const seen = cart.summary.total;
    try {
      const info = await checkout.startPayment(seen.centAmount);
      onPayment(info, seen.centAmount);
    } catch (error) {
      if (error instanceof CheckoutError && error.code === 'SIGN_IN_REQUIRED') {
        router.push('/login?next=%2Fbundle%2Fcheckout%3Fstep%3Dreview');
      } else if (error instanceof CheckoutError && error.code === 'TOTAL_CHANGED') {
        const next = (error.details?.total ?? seen) as Money;
        setChanged({ old: seen, next });
      } else if (error instanceof CheckoutError && error.code === 'FINANCING_DECLINED' && error.details?.decision) {
        setDeclined(error.details.decision as FinancingDecision);
      } else {
        setFailure(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  const financed = devices.filter((line) => line.acquisition && line.acquisition.mode !== 'outright').map((line) => ({ id: line.id, name: line.name }));

  return (
    <div className="flex flex-col gap-8" aria-labelledby="checkout-review">
      <h2 id="checkout-review" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('review.heading')}
      </h2>

      {plans.length > 0 ? (
        <section aria-label={t('review.plans')} className="flex flex-col gap-6">
          <h3 className={H3}>{t('review.plans')}</h3>
          {plans.map((line) => (
            <div key={line.id} className="flex flex-col gap-4">
              <div className="flex justify-between gap-4 text-md font-semibold">
                <span>
                  {line.name}
                  {line.quantity > 1 ? ` · ${t('review.quantity', { count: line.quantity })}` : ''}
                </span>
                <span>{priceOf(line)}</span>
              </div>
              {line.schedule ? <PriceSchedule schedule={line.schedule} locale={locale} /> : null}
              {line.label ? <BroadbandLabel label={line.label} /> : null}
            </div>
          ))}
        </section>
      ) : null}

      {devices.length > 0 ? (
        <section aria-label={t('review.devices')} className="flex flex-col gap-4">
          <h3 className={H3}>{t('review.devices')}</h3>
          {devices.map((line) => (
            <div key={line.id} className="flex flex-col gap-3">
              <div className="flex justify-between gap-4 text-md font-semibold">
                <span>{line.name}</span>
                <span>{priceOf(line)}</span>
              </div>
              {line.acquisition ? <AcquisitionSummary quote={lineQuote(line.total, line.acquisition, new Date())} /> : null}
            </div>
          ))}
        </section>
      ) : null}

      {extras.length > 0 ? (
        <section aria-label={t('review.addons')} className="flex flex-col gap-3">
          <h3 className={H3}>{t('review.addons')}</h3>
          {extras.map((line) => (
            <div key={line.id} className="flex justify-between gap-4 text-md">
              <span>
                {line.name}
                {line.quantity > 1 ? ` · ${t('review.quantity', { count: line.quantity })}` : ''}
              </span>
              <span>{priceOf(line)}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-md">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="m-0 font-display text-sm font-semibold">{t('review.contact')}</h4>
            <Link href="/bundle/checkout?step=contact" className={LINK}>
              {t('review.change')}
            </Link>
          </div>
          <span>{state.email}</span>
          {state.phone ? <span>{state.phone}</span> : null}
        </div>
        {state.serviceAddress ? <AddressBlock title={t('review.serviceAddress')} address={state.serviceAddress} change={{ href: '/bundle/checkout?step=address', label: t('review.change') }} /> : null}
        {state.billingAddress && state.serviceAddress && !sameAddress(state.billingAddress, state.serviceAddress) ? (
          <AddressBlock title={t('review.billingAddress')} address={state.billingAddress} change={{ href: '/bundle/checkout?step=address', label: t('review.change') }} />
        ) : null}
        {state.delivery ? (
          <div className="flex flex-col gap-1 text-md">
            <div className="flex items-baseline justify-between gap-4">
              <h4 className="m-0 font-display text-sm font-semibold">{t('review.delivery')}</h4>
              {state.needsDelivery ? (
                <Link href="/bundle/checkout?step=delivery" className={LINK}>
                  {t('review.change')}
                </Link>
              ) : null}
            </div>
            <span>
              {state.delivery.name} · {fmt(state.delivery.price)}
            </span>
          </div>
        ) : null}
      </section>

      <p className="m-0 text-md font-semibold">{t('review.serviceStart', { date: formatDate(review.serviceStartDate, locale) })}</p>

      <label className="flex items-start gap-4 text-md">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-action" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>
          {t.rich('review.agree', {
            terms: (chunks) => (
              <PolicyLink policy="terms" className="underline underline-offset-4">
                {chunks}
              </PolicyLink>
            ),
          })}
        </span>
      </label>

      {changed ? <TotalChangedNotice oldTotal={changed.old} newTotal={changed.next} onReview={() => setChanged(null)} /> : null}
      {declined ? <FinancingDecisionNotice decision={declined} lines={financed} onChanged={() => void checkout.refresh().then(() => setDeclined(null))} /> : null}
      {failure ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-5">
        <Button onClick={() => void pay()} loading={busy} disabled={!agreed}>
          {t('continueToPayment')}
        </Button>
        {!agreed ? <span className="text-sm text-text-muted">{t('review.agreeRequired')}</span> : null}
      </div>
    </div>
  );
}
