// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { COUNTRIES, MARKETS, type Country, type Currency } from './base';
import { recurrencePolicyDrafts } from './extras';
import { allVariants, type ProductDef, type VariantDef } from './products';

/**
 * Embedded prices per variant (decision D-017): one for US/USD and CA/CAD (both tax-exclusive).
 * USD is the base table (`VariantDef.usd`); CAD is about 1.37 of USD, rounded to the nearest 5 cents
 * so amounts end in .x0 or .x5. Subscribable products also get `recurrencePrices` for every recurrence policy, 10% below
 * the one-time price of the market.
 */
export const FX: Record<Currency, number> = { USD: 1, CAD: 1.37 };
export const RECURRENCE_DISCOUNT = 0.1;

const round5 = (n: number): number => Math.round(n / 5) * 5;

export const oneTimeCents = (usd: number, currency: Currency): number => (currency === 'USD' ? usd : round5(usd * FX[currency]));
export const recurringCents = (oneTime: number): number => Math.round(oneTime * (1 - RECURRENCE_DISCOUNT));

export interface PriceDef {
  sku: string;
  country: Country;
  currency: Currency;
  cents: number;
  /** Recurrence policy key; absent for the one-time price. */
  policy?: string;
}

export function priceDefsOf(product: ProductDef, variant: VariantDef): PriceDef[] {
  const out: PriceDef[] = COUNTRIES.map((country) => {
    const currency = MARKETS[country].currency;
    return { sku: variant.sku, country, currency, cents: oneTimeCents(variant.usd, currency) };
  });
  if (product.subscribable) {
    for (const rp of recurrencePolicyDrafts) {
      for (const base of [...out].filter((p) => !p.policy)) out.push({ ...base, cents: recurringCents(base.cents), policy: rp.key });
    }
  }
  return out;
}

export const allPriceDefs = (): PriceDef[] => allVariants().flatMap(({ product, variant }) => priceDefsOf(product, variant));

/** Canonical text form of a price, used to compare what exists with what the seed wants. */
export const priceSig = (p: { country?: string; currency: string; cents: number; policy?: string }): string => `${p.country ?? '-'}:${p.currency}:${p.cents}:${p.policy ?? 'one-time'}`;

/** PriceDraft as sent to the API. SDK 8 types `PriceDraft` without `recurrencePolicy`, the API accepts it (see plans/notes/seed-findings.md). */
export const priceDraftsOf = (product: ProductDef, variant: VariantDef): Record<string, unknown>[] =>
  priceDefsOf(product, variant).map((p) => ({
    key: `${p.country.toLowerCase()}-${p.policy ? p.policy.replace('mcf-', '') : 'one-time'}`,
    value: { currencyCode: p.currency, centAmount: p.cents },
    country: p.country,
    ...(p.policy ? { recurrencePolicy: { typeId: 'recurrence-policy', key: p.policy } } : {}),
  }));
