'use client';

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CheckoutError } from '@/hooks/useCheckout';
import { Link, useRouter } from '@/i18n/routing';
import { parseCheckoutMessage, type CheckoutEvent } from '@/lib/checkout/events';
import { checkoutStyles } from '@/lib/checkout/styles';
import { COMPLETE_MAX_ATTEMPTS, sdkLocale, TOTAL_RECHECK_MS } from '@/lib/config/checkout';
import type { CheckoutSessionInfo, Money } from '@/lib/types';
import { PlacementFailedPanel } from './PlacementFailedPanel';
import { TotalChangedNotice } from './TotalChangedNotice';
import type { CheckoutApi } from './types';
import { useCheckoutErrorText } from './useCheckoutError';

type Props = {
  checkout: CheckoutApi;
  info: CheckoutSessionInfo;
  /** The total the payment was started for (what the buyer saw). */
  baselineTotalCents: number;
  /** A new payment session for the same bundle and the SAME order number. */
  onRestart: () => Promise<void>;
  /** Back to the review step (`cancelled` shows the "Payment was cancelled" notice). */
  onBackToReview: (reason?: 'cancelled') => void;
};

/**
 * Step 5. Hosted: mounts the commercetools Checkout (`paymentFlow` in Payment Only mode, D-061) inline in `<div data-ctc />`, translates its
 * messages (`parseCheckoutMessage`) and hands the created order to `/api/checkout/complete` ONCE. Demo mode (no Checkout application
 * configured): one button places the order as the hosted Checkout would. While the step is open the total is re-read on tab focus and every
 * minute; a different total unmounts the widget and asks the buyer to review and pay again (D-042).
 */
export function PaymentStep({ checkout, info, baselineTotalCents, onRestart, onBackToReview }: Props): ReactElement {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const errorText = useCheckoutErrorText();
  const host = useRef<HTMLDivElement>(null);
  const handed = useRef(false);

  const [banner, setBanner] = useState<'failed' | null>(null);
  const [expired, setExpired] = useState(false);
  const [placementFailed, setPlacementFailed] = useState(false);
  const [changed, setChanged] = useState<{ old: Money; next: Money } | null>(null);
  const [finishing, setFinishing] = useState<{ orderId: string; attempts: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const active = !expired && !placementFailed && !changed && !finishing;

  const finish = useCallback(
    async (orderId: string): Promise<void> => {
      try {
        const orderNumber = await checkout.completeOrder(orderId);
        router.replace(`/order-confirmation/${orderNumber}`);
      } catch {
        setFinishing((current) => ({ orderId, attempts: (current?.attempts ?? 0) + 1 }));
      }
    },
    [checkout, router],
  );

  const onEvent = useCallback(
    (event: CheckoutEvent): void => {
      switch (event.type) {
        case 'order-created':
          if (handed.current) return; // both completion codes arrive: hand the order over once
          handed.current = true;
          setFinishing({ orderId: event.orderId, attempts: 0 });
          void finish(event.orderId);
          return;
        case 'payment-failed':
          setBanner('failed');
          return;
        case 'cancelled':
          onBackToReview('cancelled');
          return;
        case 'session-expired':
          setExpired(true);
          return;
        case 'not-orderable':
          setPlacementFailed(true);
          return;
        case 'cart-gone':
          router.replace('/bundle');
          return;
        default:
      }
    },
    [finish, onBackToReview, router],
  );
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  }, [onEvent]);

  // The hosted widget: one start per mount of an active step (React 19 StrictMode runs the effect twice in development; the first run is
  // cancelled before the SDK resolves, so exactly one widget starts).
  const { mode, flow, projectKey, region, sessionId } = info;
  useEffect(() => {
    if (mode !== 'hosted' || !active || !projectKey || !region || !sessionId) return;
    let cancelled = false;
    const element = host.current;
    void import('@commercetools/checkout-browser-sdk').then((sdk) => {
      if (cancelled) return;
      const handle = (message: unknown): void => latest.current(parseCheckoutMessage(message));
      const start = flow === 'checkout' ? sdk.checkoutFlow : sdk.paymentFlow;
      start({
        projectKey,
        region,
        sessionId,
        locale: sdkLocale(locale),
        styles: checkoutStyles(),
        onInfo: handle,
        onWarn: handle,
        onError: handle,
        ...(flow === 'checkout' ? { skipPaymentSuccessPage: true, skipPaymentErrorPage: true } : {}),
      });
    });
    return () => {
      cancelled = true;
      element?.replaceChildren();
    };
  }, [mode, flow, projectKey, region, sessionId, locale, active]);

  // D-042: the total can move while the payment is open (another tab, a discount ending). Compare on focus and every minute.
  const { refresh } = checkout;
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const check = async (): Promise<void> => {
      try {
        const next = (await refresh()).cart.summary.total;
        if (!stopped && next.centAmount !== baselineTotalCents) setChanged({ old: { centAmount: baselineTotalCents, currencyCode: next.currencyCode }, next });
      } catch {
        // A failed re-read changes nothing: the server enforces the same rule when a session starts.
      }
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void check(), TOTAL_RECHECK_MS);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [active, refresh, baselineTotalCents]);

  async function demoPay(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const orderNumber = await checkout.demoPay(baselineTotalCents);
      router.replace(`/order-confirmation/${orderNumber}`);
    } catch (error) {
      if (error instanceof CheckoutError && error.code === 'TOTAL_CHANGED') {
        const next = (error.details?.total ?? { centAmount: baselineTotalCents, currencyCode: checkout.state.cart.currencyCode }) as Money;
        setChanged({ old: { centAmount: baselineTotalCents, currencyCode: next.currencyCode }, next });
      } else if (error instanceof CheckoutError && error.code === 'SIGN_IN_REQUIRED') {
        router.push('/login?next=%2Fbundle%2Fcheckout%3Fstep%3Dreview');
      } else {
        setFailure(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function restart(): Promise<void> {
    setBusy(true);
    try {
      await onRestart();
      setExpired(false);
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function reviewAgain(): Promise<void> {
    try {
      await checkout.refresh();
    } finally {
      onBackToReview();
    }
  }

  return (
    <div className="flex flex-col gap-6" aria-labelledby="checkout-payment">
      <h2 id="checkout-payment" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('payment.heading')}
      </h2>

      {banner === 'failed' ? (
        <p role="alert" className="m-0 rounded-lg border-2 border-danger p-4 text-md font-semibold">
          {t('paymentFailed')}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      {changed ? <TotalChangedNotice oldTotal={changed.old} newTotal={changed.next} onReview={() => void reviewAgain()} /> : null}
      {placementFailed ? <PlacementFailedPanel onReview={() => void reviewAgain()} /> : null}
      {expired ? (
        <div role="alert" className="flex flex-col gap-4 rounded-xl border-2 border-border p-5">
          <p className="m-0 text-md font-semibold">{t('expired')}</p>
          <div>
            <Button onClick={() => void restart()} loading={busy}>
              {t('restart')}
            </Button>
          </div>
        </div>
      ) : null}
      {finishing ? (
        <div role="status" className="flex flex-col gap-4 rounded-xl border-2 border-border p-5">
          <p className="m-0 text-md font-semibold">{t('finishing')}</p>
          {finishing.attempts > 0 ? (
            <div className="flex flex-wrap items-center gap-5">
              <Button onClick={() => void finish(finishing.orderId)}>{t('finishRetry')}</Button>
              {finishing.attempts >= COMPLETE_MAX_ATTEMPTS ? <Link href={`/order-confirmation/${info.orderNumber}`}>{t('finishLink')}</Link> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {active && mode === 'demo' ? (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-border bg-brand-100 p-6">
          <h3 className="m-0 font-display text-lg font-bold">{t('payment.demo.title')}</h3>
          <p className="m-0 text-md">{t('payment.demo.body')}</p>
          <div>
            <Button onClick={() => void demoPay()} loading={busy}>
              {t('payment.demo.pay')}
            </Button>
          </div>
        </div>
      ) : null}
      {active && mode === 'hosted' ? (
        <div ref={host} data-ctc="" aria-busy="true" aria-label={t('payment.loading')} />
      ) : null}
    </div>
  );
}
