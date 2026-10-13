// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { formatTime } from '@/lib/store/format';
import type { OpeningHours, Weekday } from '@/lib/types';

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// 2000-01-03 was a Monday: a fixed date gives the weekday names in the page language.
const dayName = (day: Weekday, locale: string): string => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2000, 0, 3 + DAYS.indexOf(day))));

export interface PickupReady {
  orderNumber: string;
  /** The branch of the order (its name, address and hours), or the store when the branch is unknown. */
  storeName: string;
  address: { street: string; postalCode: string; city: string } | null;
  hours: OpeningHours | null;
}

/** The top notice of the account home for an order in the `ready-for-pickup` state: store, address, opening hours and the order number. */
export function PickupReadyNotice({ ready, store }: { ready: PickupReady; store: string }) {
  const t = useTranslations('account.overview');
  const locale = useLocale();
  return (
    <section aria-labelledby={`pickup-${ready.orderNumber}`} className="grid gap-3 rounded-md border border-border-brand bg-action-subtle p-4">
      <h2 id={`pickup-${ready.orderNumber}`} className="m-0 font-display text-lg font-semibold text-text">
        {t('pickupNoticeTitle', { number: ready.orderNumber })}
      </h2>
      <p className="m-0 font-ui text-sm text-text-body">
        {ready.address ? t('pickupNoticeBody', { store: ready.storeName, street: ready.address.street, postalCode: ready.address.postalCode, city: ready.address.city }) : ready.storeName}
      </p>
      {ready.hours ? (
        <dl aria-label={t('pickupHours')} className="m-0 grid gap-1 font-ui text-sm text-text-body">
          {DAYS.map((day) => {
            const range = ready.hours?.[day];
            return (
              <div key={day} className="flex gap-4">
                <dt className="min-w-7 text-text-muted">{dayName(day, locale)}</dt>
                <dd className="m-0">{range ? `${formatTime(range[0], locale)} – ${formatTime(range[1], locale)}` : t('pickupClosed')}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      <div>
        <Link href={`/${store}/account/orders/${ready.orderNumber}`} className={buttonClass('primary')}>
          {t('pickupView')}
        </Link>
      </div>
    </section>
  );
}
