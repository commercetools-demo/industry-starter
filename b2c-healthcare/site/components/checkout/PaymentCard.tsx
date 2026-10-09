'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Inputs';
import { Link } from '@/i18n/routing';
import type { PaymentMode, PaymentSessionInfo } from '@/lib/types';

/** What the payment widget reports; the page decides what each means for the order. */
export type PaymentEvent = 'started' | 'completed' | 'failed' | 'cancelled';

export interface PaymentCardProps {
  mode: PaymentMode;
  /** Address and delivery method are on the cart; payment cannot start before. */
  ready: boolean;
  /** The Checkout session the gate (`/api/checkout/prepare`) created for this cart; null until the buyer continues to payment. */
  session: PaymentSessionInfo | null;
  /** Inline message from the page (declined payment, ...). */
  message?: string | null;
  /** `completed` carries the id of the order Checkout created. */
  onEvent: (event: PaymentEvent, orderId?: string) => void;
  /** Demo provider only. */
  simulateDecline: boolean;
  onSimulateDeclineChange: (value: boolean) => void;
  /** Nothing is left for the card (the allowance and the restricted instrument cover the order): no widget, no authorization. */
  noCard?: boolean;
}

type Phase = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Payment. Production path: once the pre-checkout gate has passed, the commercetools Checkout browser SDK
 * (`checkoutFlow`, the full flow) renders inside this card at `<div data-ctc />`; it authorizes the card and creates the
 * order. Card data is entered in the SDK's own frame and never touches storefront code (there is no card input in this
 * file, and a test keeps it that way). Its `checkout_completed` message carries the order id.
 *
 * Development path (`MALVA_FIXTURES=1` only): a visible "DEMO payment (no PSP configured)" banner and one checkbox to
 * simulate a decline; no card fields, nothing prefilled.
 */
export function PaymentCard({ mode, ready, session, message, onEvent, simulateDecline, onSimulateDeclineChange, noCard = false }: PaymentCardProps) {
  const t = useTranslations('checkout.payment');
  const locale = useLocale();
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const sessionId = session?.sessionId;
  const projectKey = session?.projectKey;
  const region = session?.region;
  // The outcome belongs to the run that produced it (session, locale); a newer run starts as `loading`.
  const runKey = `${sessionId ?? ''}|${locale}`;
  const [outcome, setOutcome] = useState<{ key: string; phase: Phase } | null>(null);
  const phase: Phase = mode !== 'psp' || !ready || noCard || !sessionId ? 'idle' : outcome?.key === runKey ? outcome.phase : 'loading';

  useEffect(() => {
    if (mode !== 'psp' || !ready || noCard || !sessionId || !projectKey || !region) return;
    let cancelled = false;
    const finish = (next: Phase) => {
      if (!cancelled) setOutcome({ key: runKey, phase: next });
    };
    (async () => {
      try {
        const sdk = await import('@commercetools/checkout-browser-sdk');
        if (cancelled) return;
        // The browser's message only carries the order id; the server reads everything else from the platform.
        sdk.checkoutFlow({
          projectKey,
          region,
          sessionId,
          locale,
          onInfo: (m) => {
            if (m.code === 'payment_started') onEventRef.current('started');
            else if (m.code === 'checkout_completed') onEventRef.current('completed', (m.payload as { order?: { id?: string } } | undefined)?.order?.id);
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
  }, [mode, ready, noCard, sessionId, projectKey, region, runKey, locale]);

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
      ) : noCard ? (
        <p className="rounded-md bg-success-50 px-3.5 py-2.5 text-sm font-medium text-success-700" data-no-card>
          {t('noCardNeeded')}
        </p>
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
          {phase === 'failed' ? (
            <p className="text-sm font-medium text-danger-700" role="alert">
              {t('loadFailed')}
            </p>
          ) : null}
          {phase === 'idle' ? <p className="text-sm text-neutral-600">{t('continueHint')}</p> : null}
          {/* Mount point of the Checkout flow (inline, not the full-screen overlay); it exists only once the gate has passed. */}
          {session ? <div data-ctc /> : null}
          {/* Stored Payment Methods (workstream T): Checkout lists the customer's saved cards first and offers "Save this card"
              itself, because the cart carries the customer id. Nothing here touches a card. */}
          <p className="text-sm text-neutral-600" data-saved-hint>
            {t('savedHint')}{' '}
            <Link href="/account/payment-methods" className="text-text-link">
              {t('manageSaved')}
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
