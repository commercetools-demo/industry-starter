'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { formatMoney, marketForLocale } from '@/lib/utils';

/**
 * The two money paths of the assistant UI (workstream T). They are separate on purpose: routing a minor-unit field through the
 * major-unit hook multiplies it twice.
 *  - `useAgentMoney()` formats a MAJOR-unit amount from an agent payload (349 is 349 dollars): converts to minor units with the
 *    currency's own fraction digits, then the app's `formatMoney`.
 *  - `useCentMoney()` formats a field the server already sent in MINOR units (the checkout card's totals).
 * The currency is the payload's when it carries one, else the shopper's market; the locale is always the route locale.
 */

/** Fraction digits of a currency as Intl knows them (USD and CAD are 2, JPY 0). */
export function fractionDigits(currency: string): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Major units to integer minor units, rounded half away from zero on the cent so 4.35 never becomes 434. */
export function toMinor(amount: number, currency: string): number {
  const factor = 10 ** fractionDigits(currency);
  return Math.round(Math.round(amount * factor * 1000) / 1000);
}

export function formatAgentAmount(amount: number, currency: string, locale: string): string {
  return formatMoney(toMinor(amount, currency), currency, locale);
}

export function useAgentMoney(): (amount: number, currency?: string) => string {
  const locale = useLocale();
  const market = marketForLocale(locale);
  return useCallback((amount, currency) => formatAgentAmount(amount, currency ?? market.currency, locale), [locale, market.currency]);
}

export function useCentMoney(): (minor: number, currency?: string) => string {
  const locale = useLocale();
  const market = marketForLocale(locale);
  return useCallback((minor, currency) => formatMoney(minor, currency ?? market.currency, locale), [locale, market.currency]);
}
