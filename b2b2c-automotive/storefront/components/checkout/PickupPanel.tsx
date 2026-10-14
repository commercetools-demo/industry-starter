// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatTime } from '@/lib/store/format';
import type { CheckoutPickup, Weekday } from '@/lib/types';

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// 2000-01-03 was a Monday: a fixed date gives the weekday names in the page language.
const dayName = (day: Weekday, locale: string): string => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2000, 0, 3 + DAYS.indexOf(day))));

/** The quiet pickup panel of the design: branch address, opening hours and the ID reminder. Shown only for a pickup cart. */
export function PickupPanel({ pickup }: { pickup: CheckoutPickup }) {
  const t = useTranslations('checkout.pickup');
  const locale = useLocale();
  const { street, postalCode, city } = pickup.address;
  return (
    <aside aria-labelledby="checkout-pickup-title" className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4">
      <h2 id="checkout-pickup-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title', { branch: pickup.branchName })}
      </h2>
      <p className="m-0 font-ui text-sm text-text-body">
        <span className="sr-only">{t('addressLabel')}: </span>
        {street}, {postalCode} {city}
      </p>
      <dl aria-label={t('hoursLabel')} className="m-0 grid gap-1 font-ui text-sm text-text-body">
        {DAYS.map((day) => {
          const hours = pickup.hours[day];
          return (
            <div key={day} className="flex gap-4">
              <dt className="min-w-7 text-text-muted">{dayName(day, locale)}</dt>
              <dd className="m-0">{hours ? `${formatTime(hours[0], locale)} – ${formatTime(hours[1], locale)}` : t('closed')}</dd>
            </div>
          );
        })}
      </dl>
      <p className="m-0 font-ui text-sm font-medium text-text">{t('idReminder')}</p>
    </aside>
  );
}
