/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import type { Market, Money, PriceScope } from '@/lib/types';

/**
 * The subset of a commercetools embedded price the mapper reads. The raw `variant.prices[]` is used (always present on a
 * projection) because the scoped single `variant.price` returns only one of a recurring and a one-time price.
 */
export interface RawPrice {
  value: { centAmount: number; currencyCode: string };
  country?: string;
  recurrencePolicy?: unknown;
  validFrom?: string;
  validUntil?: string;
  channel?: unknown;
  customerGroup?: unknown;
}

/** Ids to keys for the references embedded prices carry (they hold ids; the buyer's scope holds keys). */
export interface ScopeKeys {
  groupKeyById: Readonly<Record<string, string>>;
  channelKeyById: Readonly<Record<string, string>>;
}

/** What a price needs to match when the buyer has a scope (see `selectPrices`). */
export interface ScopeInput {
  scope: PriceScope;
  keys: ScopeKeys;
}

const warnedScoped = new Set<string>();

const idOf = (reference: unknown): string | undefined => (typeof reference === 'object' && reference !== null && typeof (reference as { id?: unknown }).id === 'string' ? (reference as { id: string }).id : undefined);

/** Does a price scoped to a customer group and/or a channel apply to this buyer? Unknown references never match (fail closed). */
function inScope(price: RawPrice, input: ScopeInput): boolean {
  if (price.customerGroup) {
    const key = input.keys.groupKeyById[idOf(price.customerGroup) ?? ''];
    if (!key || !input.scope.groupKeys.includes(key)) return false;
  }
  if (price.channel) {
    const key = input.keys.channelKeyById[idOf(price.channel) ?? ''];
    if (!key || key !== input.scope.channelKey) return false;
  }
  return true;
}

/** Prices that apply to the market right now: currency, no channel/customer group, valid dates, country-specific over country-less. */
function applicable(prices: ReadonlyArray<RawPrice>, market: Market, now: Date, sku: string, scope?: ScopeInput): RawPrice[] {
  const timestamp = now.getTime();
  const kept = prices.filter((price) => {
    if (price.value.currencyCode !== market.currency) return false;
    if (price.channel || price.customerGroup) {
      if (!scope) {
        if (!warnedScoped.has(sku)) {
          warnedScoped.add(sku);
          console.warn('[catalog] ignoring scoped price', sku);
        }
        return false;
      }
      if (!inScope(price, scope)) return false;
    }
    if (price.validFrom && Date.parse(price.validFrom) > timestamp) return false;
    if (price.validUntil && Date.parse(price.validUntil) <= timestamp) return false;
    return price.country === undefined || price.country === market.country;
  });
  return kept;
}

/** A price made for this buyer's group or channel wins over the standard one (then the lowest of those), as the platform does. */
function preferScoped(prices: RawPrice[]): RawPrice[] {
  const scoped = prices.filter((price) => price.customerGroup || price.channel);
  return scoped.length > 0 ? scoped : prices;
}

function preferCountry(prices: RawPrice[], market: Market): RawPrice[] {
  const specific = prices.filter((price) => price.country === market.country);
  return specific.length > 0 ? specific : prices;
}

const lowest = (prices: RawPrice[]): Money | undefined => {
  const best = prices.reduce<RawPrice | undefined>((acc, price) => (!acc || price.value.centAmount < acc.value.centAmount ? price : acc), undefined);
  return best ? { centAmount: best.value.centAmount, currencyCode: best.value.currencyCode } : undefined;
};

/**
 * Recurring = a price with a recurrence policy (the monthly charge, D-012); one-time = without (activation fee, purchase).
 * Per kind: a price scoped to the buyer's customer group or channel wins over the standard price, then the country-specific price over a
 * country-less one, then the lowest amount. Without a `scope` (device financing, scripts) scoped prices are ignored.
 */
export function selectPrices(prices: ReadonlyArray<RawPrice>, market: Market, now: Date, sku = '', scope?: ScopeInput): { recurring?: Money; oneTime?: Money } {
  const usable = applicable(prices, market, now, sku, scope);
  const recurring = lowest(preferCountry(preferScoped(usable.filter((price) => price.recurrencePolicy)), market));
  const oneTime = lowest(preferCountry(preferScoped(usable.filter((price) => !price.recurrencePolicy)), market));
  return { ...(recurring ? { recurring } : {}), ...(oneTime ? { oneTime } : {}) };
}

/**
 * Every recurring price of the market with the id of its recurrence policy (device installments and leases): one entry per policy,
 * the country-specific price winning over a country-less one, then the lowest amount. Policy ids are resolved to keys by Q's
 * `getDevicePolicyMap`, so the catalog cache stays free of any policy lookup.
 */
export function selectFinancedOptions(prices: ReadonlyArray<RawPrice>, market: Market, now: Date, sku = ''): { policyId: string; amount: Money }[] {
  const byPolicy = new Map<string, RawPrice[]>();
  for (const price of applicable(prices, market, now, sku)) {
    const policy = price.recurrencePolicy as { id?: unknown } | undefined;
    if (typeof policy?.id !== 'string') continue;
    byPolicy.set(policy.id, [...(byPolicy.get(policy.id) ?? []), price]);
  }
  return [...byPolicy.entries()].flatMap(([policyId, list]) => {
    const amount = lowest(preferCountry(list, market));
    return amount ? [{ policyId, amount }] : [];
  });
}

/** Every recurring price of the market (device installments and leases), lowest first. */
export function selectRecurringPrices(prices: ReadonlyArray<RawPrice>, market: Market, now: Date, sku = ''): Money[] {
  return preferCountry(
    applicable(prices, market, now, sku).filter((price) => price.recurrencePolicy),
    market,
  )
    .map((price) => ({ centAmount: price.value.centAmount, currencyCode: price.value.currencyCode }))
    .sort((a, b) => a.centAmount - b.centAmount);
}
