// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Locale-aware display helpers for the shell and the picker. Pure.
import { COUNTRY_CONFIG } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';

/** "20:00" as "8 PM" (en-US) or "20 Uhr" (de-DE); minutes are shown only when not zero ("8:30 AM", "8:30 Uhr"). */
export function formatTime(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h, m || 0));
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', hour: 'numeric', ...(m ? { minute: '2-digit' as const } : {}) };
  const text = new Intl.DateTimeFormat(locale, opts).format(date);
  if (locale.startsWith('de')) return /Uhr$/.test(text) ? text : `${text} Uhr`;
  return text.replace(/ /g, ' ');
}

/** "2,3 km" or "2.3 km": one decimal under 10 km, whole kilometres above. */
export function formatDistance(km: number, locale: string): string {
  const fraction = km < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(km)} km`;
}

/** "Deutschland (EUR €)" for de-DE, "United States (USD $)" for en-US: country name in the page language, code and symbol. */
export function marketLabel(locale: AppLocale): string {
  const { country, currency } = COUNTRY_CONFIG[locale];
  const name = new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country;
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  return `${name} (${currency} ${symbol})`;
}
