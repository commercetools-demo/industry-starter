// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Button, buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { CheckoutErrorReason } from '@/lib/types';

const MESSAGE: Record<CheckoutErrorReason, 'cartMissing' | 'cartEmpty' | 'linesUnavailable' | 'subscriptionsUnavailable' | 'notConfigured' | 'unavailable'> = {
  'cart-missing': 'cartMissing',
  'cart-empty': 'cartEmpty',
  'lines-unavailable': 'linesUnavailable',
  'subscriptions-unavailable': 'subscriptionsUnavailable',
  'not-configured': 'notConfigured',
  unavailable: 'unavailable',
};
/** Only a failure that may be temporary offers a retry; the others need a change in the cart or in the configuration. */
const RETRYABLE: ReadonlySet<CheckoutErrorReason> = new Set(['unavailable']);

/** Plain text from our own messages, a Back to cart link and, when it can help, Try again. Never HTML, never a server message. */
export function CheckoutError({ reason, cartHref, onRetry }: { reason: CheckoutErrorReason; cartHref: string; onRetry: () => void }) {
  const t = useTranslations('checkout');
  return (
    <div role="alert" className="grid gap-4 rounded-md border border-border bg-surface p-5">
      <p className="m-0 font-ui text-md text-text-body">{t(`errors.${MESSAGE[reason]}`)}</p>
      <div className="flex flex-wrap items-center gap-3">
        {RETRYABLE.has(reason) ? (
          <Button onClick={onRetry}>{t('retry')}</Button>
        ) : null}
        <Link href={cartHref} className={buttonClass(RETRYABLE.has(reason) ? 'secondary' : 'primary')}>
          {t('backToCart')}
        </Link>
      </div>
    </div>
  );
}
