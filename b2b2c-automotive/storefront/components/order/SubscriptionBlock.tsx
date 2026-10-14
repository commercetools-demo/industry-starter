// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { OrderView } from '@/lib/types';

/**
 * Subscription lines of the order: the frequency of each, and the next delivery date taken from the Recurring Order. Commercetools creates
 * that asynchronously: until it exists the block says "being set up" and shows no date (never a guessed one).
 */
export function SubscriptionBlock({ view, store, signedIn }: { view: OrderView; store: string; signedIn: boolean }) {
  const t = useTranslations('order.subscription');
  const locale = useLocale();
  const subscription = view.subscription;
  if (!subscription) return null;
  const date = subscription.nextOrderAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: view.timezone }).format(new Date(subscription.nextOrderAt)) : null;
  const status = subscription.state === 'setting-up' ? t('settingUp') : subscription.state === 'paused' ? t('paused') : subscription.state === 'ended' ? t('ended') : null;
  return (
    <section aria-labelledby="order-subscription-title" className="grid gap-2 rounded-md border border-border bg-info-50 p-4 print:border-0 print:p-0">
      <h2 id="order-subscription-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <ul className="m-0 grid list-none gap-1 p-0 font-ui text-sm text-text-body">
        {subscription.frequencies.map((frequency) => (
          <li key={frequency}>{t('frequency', { frequency })}</li>
        ))}
      </ul>
      {date ? <p className="m-0 font-ui text-sm font-medium text-text">{t('next', { date })}</p> : null}
      {status ? <p className="m-0 font-ui text-sm text-text-body">{status}</p> : null}
      {signedIn ? (
        <div className="print:hidden">
          <Link href={`/${store}/account/subscriptions`} className={buttonClass('link', 'px-0')}>
            {t('manage')}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
