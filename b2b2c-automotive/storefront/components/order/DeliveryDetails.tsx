// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatTime } from '@/lib/store/format';
import type { OrderView, Weekday } from '@/lib/types';

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// 2000-01-03 was a Monday: a fixed date gives the weekday names in the page language.
const dayName = (day: Weekday, locale: string): string => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2000, 0, 3 + DAYS.indexOf(day))));

/**
 * Pickup: the branch name, address, opening hours and the photo ID reminder (facts of the order's branch). Ship: the delivery address the
 * shopper entered in the hosted Checkout. Nothing is rendered when the order has neither (an unknown branch).
 */
export function DeliveryDetails({ view }: { view: OrderView }) {
  const t = useTranslations('order');
  const locale = useLocale();
  const country = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;

  if (view.mode === 'pickup' && view.pickup) {
    const { branchName, address, hours, phone } = view.pickup;
    return (
      <section aria-labelledby="order-delivery-title" className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4 print:border-0 print:p-0">
        <h2 id="order-delivery-title" className="m-0 font-display text-md font-semibold text-text">
          {t('pickup.title', { branch: branchName })}
        </h2>
        <p className="m-0 font-ui text-sm text-text-body">
          <span className="sr-only">{t('pickup.addressLabel')}: </span>
          {address.street}, {address.postalCode} {address.city}
        </p>
        {phone ? (
          <p className="m-0 font-ui text-sm text-text-body">
            <span className="text-text-muted">{t('pickup.phone')}: </span>
            {phone}
          </p>
        ) : null}
        <dl aria-label={t('pickup.hoursLabel')} className="m-0 grid gap-1 font-ui text-sm text-text-body">
          {DAYS.map((day) => {
            const range = hours[day];
            return (
              <div key={day} className="flex gap-4">
                <dt className="min-w-7 text-text-muted">{dayName(day, locale)}</dt>
                <dd className="m-0">{range ? `${formatTime(range[0], locale)} – ${formatTime(range[1], locale)}` : t('pickup.closed')}</dd>
              </div>
            );
          })}
        </dl>
        <p className="m-0 font-ui text-sm font-medium text-text">{t('pickup.idReminder')}</p>
      </section>
    );
  }

  if (view.mode === 'ship' && view.shipTo) {
    const { name, street, postalCode, city, country: code } = view.shipTo;
    return (
      <section aria-labelledby="order-delivery-title" className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4 print:border-0 print:p-0">
        <h2 id="order-delivery-title" className="m-0 font-display text-md font-semibold text-text">
          {t('ship.title')}
        </h2>
        <address className="m-0 grid gap-1 font-ui text-sm not-italic text-text-body">
          {name ? <span>{name}</span> : null}
          {street ? <span>{street}</span> : null}
          <span>{[postalCode, city].filter(Boolean).join(' ')}</span>
          <span>{country(code)}</span>
        </address>
      </section>
    );
  }
  return null;
}
