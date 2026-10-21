'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import type { HostedSession } from '@/hooks/useCheckout';
import { sdkLocale, startHostedCheckout } from '@/lib/checkout/hosted-sdk';
import { readCheckoutTheme } from '@/lib/checkout/theme';

export type HostedFailure = 'declined' | 'generic';

/** The SDK reports payment problems with a code that names the payment; anything else is a generic failure (live codes: probe S12). */
export function failureOf(code: string): HostedFailure {
  return /payment|declin|card/i.test(code) ? 'declined' : 'generic';
}

/**
 * The complete hosted Checkout (`checkoutFlow`, D-039) inside the Pay stage: address, delivery method and payment are the hosted
 * flow's. The hosted success and error pages are skipped; the host reacts to `checkout_completed` and to errors. The mount point
 * `<div data-ctc />` keeps the widget in this region (without it the widget would take the whole page). It starts once per session
 * id and is closed on unmount, so going back to Review unmounts it and the next Continue creates a new session.
 */
export default function HostedCheckout({
  session, onCompleted, onFailure, onUnavailable,
}: {
  session: HostedSession;
  onCompleted: () => void;
  onFailure: (kind: HostedFailure) => void;
  onUnavailable: () => void;
}) {
  const t = useTranslations('checkout.payment');
  const locale = useLocale();
  const [ready, setReady] = useState(false);
  const started = useRef<string | null>(null);
  const done = useRef(false);
  const callbacks = useRef({ onCompleted, onFailure, onUnavailable });
  useEffect(() => {
    callbacks.current = { onCompleted, onFailure, onUnavailable };
  });

  useEffect(() => {
    if (started.current === session.sessionId) return undefined;
    started.current = session.sessionId;
    done.current = false;
    let close: (() => void) | undefined;
    let cancelled = false;
    startHostedCheckout({
      projectKey: session.projectKey,
      region: session.region,
      sessionId: session.sessionId,
      locale: sdkLocale(locale),
      currencyLocale: locale,
      styles: readCheckoutTheme(),
      onInfo: (code) => {
        if (code === 'checkout_completed' && !done.current) {
          done.current = true;
          callbacks.current.onCompleted();
        }
      },
      onError: (code) => callbacks.current.onFailure(failureOf(code)),
    })
      .then((c) => {
        // A start that was cancelled before it resolved (React Strict Mode runs effects twice in development) is ignored: closing it
        // would close the widget of the start that replaced it, because the SDK keeps one global widget.
        if (!cancelled) {
          close = c;
          setReady(true);
        }
      })
      .catch(() => callbacks.current.onUnavailable());
    return () => {
      cancelled = true;
      close?.();
      started.current = null;
    };
  }, [session.sessionId, session.projectKey, session.region, locale]);

  return (
    <Card as="section" aria-label={t('region')} className="relative min-h-[480px] p-0">
      {!ready ? (
        <div role="status" className="absolute inset-0 flex animate-pulse items-center justify-center rounded-card bg-canvas-2 text-[14px] text-ink-3">
          {t('loading')}
        </div>
      ) : null}
      <div data-ctc className="min-h-[480px] max-w-full overflow-hidden" />
    </Card>
  );
}
