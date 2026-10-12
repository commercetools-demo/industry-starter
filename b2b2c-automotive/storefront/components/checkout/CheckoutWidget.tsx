// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CheckoutError } from '@/components/checkout/CheckoutError';
import { Button } from '@/components/ui/Button';
import { useCheckoutSession } from '@/hooks/useCheckoutSession';
import type { AppLocale } from '@/i18n/config';
import { checkoutLocale } from '@/lib/checkout/locale';
import { buildCheckoutStyles } from '@/lib/checkout/styles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_CODE = /[^A-Za-z0-9_.-]/g;

/** Where the shopper goes when the hosted flow reports a finished order: the locale-less return route resolves it (O D4a). */
export const returnPath = (orderId: string): string | null => (UUID.test(orderId) ? `/checkout/return?orderId=${encodeURIComponent(orderId)}` : null);

/**
 * The accessible wrapper around the hosted Checkout (the only file that imports the SDK, and only dynamically). It creates the session
 * when it mounts (and on retry), mounts `checkoutFlow` into `<div data-ctc />` exactly once per session, themes it from the store's
 * computed tokens, and sends the shopper to `/checkout/return` when the order exists. Card data lives in the hosted page, never here.
 */
export function CheckoutWidget({ cartHref, navigate = (path) => window.location.assign(path) }: { cartHref: string; navigate?: (path: string) => void }) {
  const t = useTranslations('checkout');
  const locale = useLocale() as AppLocale;
  const { state, retry } = useCheckoutSession();
  const [problem, setProblem] = useState<string | null>(null);
  const mountedFor = useRef<string | null>(null);
  // An effect event reads the latest `navigate` without making the effect (and so the mounted widget) depend on it.
  const goTo = useEffectEvent((path: string) => navigate(path));

  useEffect(() => {
    if (state.status !== 'ready') return;
    const { sessionId, projectKey, region } = state.session;
    if (mountedFor.current === sessionId) return;
    mountedFor.current = sessionId;
    let cancelled = false;
    void import('@commercetools/checkout-browser-sdk').then(({ checkoutFlow }) => {
      if (cancelled) return;
      checkoutFlow({
        projectKey,
        region,
        sessionId,
        locale: checkoutLocale(locale),
        currencyLocale: locale,
        tax: { display: true },
        skipPaymentSuccessPage: true,
        styles: buildCheckoutStyles((name) => getComputedStyle(document.documentElement).getPropertyValue(name)),
        onInfo: (message) => {
          if (message.code !== 'checkout_completed') return;
          const orderId = (message.payload as { order?: { id?: unknown } } | undefined)?.order?.id;
          const path = typeof orderId === 'string' ? returnPath(orderId) : null;
          if (path) goTo(path);
        },
        onError: (message) => setProblem(String(message.code ?? '').replace(SAFE_CODE, '').slice(0, 64) || 'unknown'),
      });
    });
    return () => {
      cancelled = true;
      mountedFor.current = null;
      void import('@commercetools/checkout-browser-sdk').then(({ close }) => close());
    };
  }, [state, locale]);

  const onRetry = () => {
    setProblem(null);
    retry();
  };

  if (state.status === 'error') return <CheckoutError reason={state.reason} cartHref={cartHref} onRetry={onRetry} />;

  return (
    <section aria-label={t('widgetLabel')} aria-busy={state.status === 'loading'} className="grid gap-4">
      {state.status === 'loading' ? (
        <div role="status" className="grid gap-3 rounded-md border border-border bg-surface p-5">
          <span className="font-ui text-sm text-text-muted">{t('loading')}</span>
          <span aria-hidden="true" className="block h-5 animate-pulse rounded-sm bg-surface-quiet" />
          <span aria-hidden="true" className="block h-5 animate-pulse rounded-sm bg-surface-quiet" />
          <span aria-hidden="true" className="block h-9 animate-pulse rounded-sm bg-surface-quiet" />
        </div>
      ) : null}
      {problem ? (
        <div role="alert" className="grid gap-3 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
          <p className="m-0">{t('widgetError')}</p>
          <p className="m-0 text-text-muted">{t('widgetErrorCode', { code: problem })}</p>
          <div>
            <Button variant="secondary" onClick={onRetry}>
              {t('retry')}
            </Button>
          </div>
        </div>
      ) : null}
      <div data-ctc="" />
    </section>
  );
}
