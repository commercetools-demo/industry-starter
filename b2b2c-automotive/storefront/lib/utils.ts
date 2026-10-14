// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { DEFAULT_LOCALE_KEY, type AppLocale } from '@/i18n/config';

export interface CountryConfig {
  locale: AppLocale;
  currency: 'EUR' | 'USD';
  country: 'DE' | 'US';
  label: string;
}

export const COUNTRY_CONFIG: Record<AppLocale, CountryConfig> = {
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE', label: 'Deutschland' },
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
};

export const DEFAULT_LOCALE = COUNTRY_CONFIG[DEFAULT_LOCALE_KEY];

/** Formats a commercetools money amount. `centAmount` is in minor units; `fractionDigits` is for high-precision prices. */
export function formatMoney(centAmount: number, currencyCode: string, locale: string, fractionDigits?: number): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
  const digits = fractionDigits ?? formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const exact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return exact.format(centAmount / 10 ** digits);
}

/** Picks a localized string: exact locale, same language, de-DE, en-US, first value, empty string. Never throws. */
export function getLocalizedString(value: Record<string, string> | null | undefined, locale: string): string {
  if (!value) return '';
  const exact = value[locale];
  if (exact) return exact;
  const language = locale.split('-')[0];
  const sameLanguage = value[language] ?? Object.entries(value).find(([key, v]) => v && key.split('-')[0] === language)?.[1];
  if (sameLanguage) return sameLanguage;
  return value['de-DE'] || value['en-US'] || Object.values(value).find(Boolean) || '';
}
