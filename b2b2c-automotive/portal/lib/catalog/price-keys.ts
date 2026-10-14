/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Standalone price keys, identical to the seed's `channelPriceKey` / `baseKey` (seed/src/data/prices.ts):
//   <sku>__<channelKey>            EUR, country DE
//   <sku>__<channelKey>__usd       USD, country US
//   <sku>__base-eur-de, <sku>__base-usd-us   the Malva list price (no channel)
export type PriceCurrency = 'EUR' | 'USD';

export const countryOfCurrency = (currency: PriceCurrency): 'DE' | 'US' => (currency === 'EUR' ? 'DE' : 'US');

const clean = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '-');

export function standalonePriceKey(sku: string, channelKey: string, currency: PriceCurrency): string {
  return `${clean(sku)}__${clean(channelKey)}${currency === 'USD' ? '__usd' : ''}`;
}

export function basePriceKey(sku: string, currency: PriceCurrency): string {
  return `${clean(sku)}__base-${currency.toLowerCase()}-${countryOfCurrency(currency).toLowerCase()}`;
}
