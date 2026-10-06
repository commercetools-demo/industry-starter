'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useCheckoutSession } from '@/hooks/useCheckoutSession';
import { useRouter } from '@/i18n/routing';
import { parseCheckoutEvent } from '@/lib/checkout-events';

/** The hosted checkout knows `de` and `en-US` (docs: Locales); `de-DE` is not on its list and would fall back to English. */
export const sdkLocale = (locale: string): string => (locale.startsWith('de') ? 'de' : locale);

type Phase = 'loading' | 'ready' | 'completing' | 'complete-failed';

/**
 * Starts a checkout session once, then lets the hosted Complete Checkout render inline in `<div data-ctc />`.
 * A session error sends the shopper back to the bag (`?checkoutError=<code>`); an "order created" message is
 * handed to the server (`complete`) before the confirmation page opens.
 */
export function CheckoutFlow() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const { start, complete } = useCheckoutSession();
  const [phase, setPhase] = useState<Phase>('loading');
  const orderRef = useRef<string | null>(null);
  const started = useRef(false);

  const finish = useCallback(
    async (orderId: string) => {
      setPhase('completing');
      const result = await complete(orderId);
      if (result.ok) router.replace(`/checkout/confirmation/${result.orderId}`);
      else setPhase('complete-failed');
    },
    [complete, router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = await start();
      if (!result.ok) {
        router.replace(`/cart?checkoutError=${encodeURIComponent(result.error)}`);
        return;
      }
      const { checkoutFlow } = await import('@commercetools/checkout-browser-sdk');
      const { sessionId, projectKey, region } = result.session;
      setPhase('ready');
      checkoutFlow({
        projectKey,
        region,
        sessionId,
        locale: sdkLocale(locale),
        skipPaymentSuccessPage: true,
        onInfo: (message) => {
          const event = parseCheckoutEvent(message);
          // `checkout_completed` and `order_created` both arrive: hand the order over once.
          if (event.type !== 'order-created' || orderRef.current) return;
          orderRef.current = event.orderId;
          void finish(event.orderId);
        },
      });
    })();
  }, [finish, locale, router, start]);

  return (
    <section aria-label={t('paymentRegion')} aria-busy={phase !== 'ready'}>
      {phase === 'loading' ? <p className="m-0 text-[15px] text-muted">{t('loading')}</p> : null}
      {phase === 'completing' ? (
        <p role="status" className="m-0 text-[15px] text-muted">
          {t('completing')}
        </p>
      ) : null}
      {phase === 'complete-failed' ? (
        <div role="alert" className="flex flex-col items-start gap-(--space-3) rounded-[var(--radius-md)] bg-accent-100 p-(--space-4)">
          <p className="m-0 text-[15px] text-accent-800">{t('completeFailed')}</p>
          <Button onClick={() => orderRef.current && void finish(orderRef.current)}>{t('retry')}</Button>
        </div>
      ) : null}
      <div data-ctc />
    </section>
  );
}
