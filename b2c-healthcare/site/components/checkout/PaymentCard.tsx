'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Inputs';
import { API_CHECKOUT_SESSION } from '@/lib/api-paths';
import type { PaymentMode, PaymentSessionInfo } from '@/lib/types';

/** What the payment widget reports; the page decides what each means for the order. */
export type PaymentEvent = 'started' | 'completed' | 'failed' | 'cancelled';

export interface PaymentCardProps {
  mode: PaymentMode;
  /** Address and delivery method are on the cart; payment cannot start before. */
  ready: boolean;
  /** Changes whenever the cart total or delivery changes: the payment session is created again for the new amount. */
  cartKey: string;
  /** Inline message from the page (declined payment, release failed, ...). */
  message?: string | null;
  onEvent: (event: PaymentEvent) => void;
  /** Demo provider only. */
  simulateDecline: boolean;
  onSimulateDeclineChange: (value: boolean) => void;
}

type Phase = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable';

/**
 * Payment. Production path: the commercetools Checkout browser SDK (`paymentFlow`, payment-only mode) renders the
 * payment component inside this card at `<div data-ctc />`; card data is entered in the SDK's own frame and never
 * touches storefront code (there is no card input in this file, and a test keeps it that way). The Place order
 * button in the summary is the SDK's custom payment button (`data-ctc-selector="paymentButton"`).
 *
 * Development path (`MALVA_FIXTURES=1` only): a visible "DEMO payment (no PSP configured)" banner and one checkbox to
 * simulate a decline; no card fields, nothing prefilled.
 */
export function PaymentCard({ mode, ready, cartKey, message, onEvent, simulateDecline, onSimulateDeclineChange }: PaymentCardProps) {
  const t = useTranslations('checkout.payment');
  const locale = useLocale();
  const [attempt, setAttempt] = useState(0);
  // The outcome belongs to the run that produced it (cart, locale, retry); a newer run starts as `loading`.
  const runKey = `${cartKey}|${locale}|${attempt}`;
  const [outcome, setOutcome] = useState<{ key: string; phase: Phase } | null>(null);
  const phase: Phase = mode !== 'psp' || !ready ? 'idle' : outcome?.key === runKey ? outcome.phase : 'loading';
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (mode !== 'psp' || !ready) return;
    let cancelled = false;
    const finish = (next: Phase) => {
      if (!cancelled) setOutcome({ key: runKey, phase: next });
    };
    (async () => {
      try {
        const response = await fetch(API_CHECKOUT_SESSION, { method: 'POST' });
        if (cancelled) return;
        if (response.status === 503) return finish('unavailable');
        if (!response.ok) return finish('failed');
        const session = (await response.json()) as PaymentSessionInfo;
        const sdk = await import('@commercetools/checkout-browser-sdk');
        if (cancelled) return;
        sdk.paymentFlow({
          projectKey: session.projectKey,
          region: session.region,
          sessionId: session.sessionId,
          locale,
          onInfo: (m) => {
            if (m.code === 'payment_started') onEventRef.current('started');
            else if (m.code === 'payment_completed' || m.code === 'checkout_completed') onEventRef.current('completed');
            else if (m.code === 'payment_cancelled') onEventRef.current('cancelled');
          },
          onError: (m) => {
            if (m.code === 'payment_failed') onEventRef.current('failed');
            else finish('failed');
          },
        });
        finish('ready');
      } catch {
        finish('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, ready, runKey, locale]);

  return (
    <Card as="section" aria-labelledby="checkout-payment-title" className="grid gap-4" data-checkout-card="payment" data-payment-mode={mode}>
      <h2 id="checkout-payment-title" className="font-display text-xl font-semibold text-navy-900">
        {t('title')}
      </h2>
      {message ? (
        <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700" data-payment-message>
          {message}
        </p>
      ) : null}
      {!ready ? (
        <p className="text-sm text-neutral-600">{t('needAddress')}</p>
      ) : mode === 'demo' ? (
        <div className="grid gap-3">
          <p className="rounded-md bg-warning-50 px-3.5 py-2.5 text-sm font-semibold text-navy-900" data-demo-banner>
            {t('demoBanner')}
          </p>
          <p className="text-sm text-neutral-600">{t('demoNote')}</p>
          <Checkbox label={t('demoDecline')} checked={simulateDecline} onChange={(event) => onSimulateDeclineChange(event.target.checked)} />
        </div>
      ) : (
        <div className="grid gap-3">
          {phase === 'loading' ? (
            <p className="text-sm text-neutral-600" aria-busy="true">
              {t('loading')}
            </p>
          ) : null}
          {phase === 'failed' || phase === 'unavailable' ? (
            <div className="grid justify-items-start gap-3" role="alert">
              <p className="text-sm font-medium text-danger-700">{phase === 'unavailable' ? t('unavailable') : t('loadFailed')}</p>
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t('retry')}
              </Button>
            </div>
          ) : null}
          {/* Mount point of the Checkout payment component (inline, not the full-screen overlay). */}
          <div data-ctc />
        </div>
      )}
    </Card>
  );
}
