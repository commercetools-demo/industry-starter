// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { StandalonePriceDraft } from '@commercetools/platform-sdk';
import { K } from './base';
import { assortmentSkus } from './assortment';
import { BUNDLES, LOCAL_PARTS, bundleEur } from './items';
import { BRANCHES } from './org';
import { PARTS } from './parts';
import { hash, retailOverrides, round10, usdFromEur } from './pricing';

/**
 * EVERY price is a standalone price (Q-003): products carry no embedded prices (`priceMode: Standalone`).
 *
 *  - Malva base price: per priced master part and Malva bundle, EUR for country DE and USD for country US, no channel,
 *    no customer group, no volume tiers (wholesale tiers are out of scope, Q-V01).
 *  - Reseller retail price: on the store's distribution channel (`mau-dist-north`, `mau-dist-south`) for about half of the
 *    carried parts; the store falls back to the base price. Reseller-owned items (local parts, own bundles) have ONLY this
 *    channel price. South also prices in USD for country US.
 *  - Branch price (Q-005): a branch channel may carry its own price; roughly one in seven carried items has one.
 *  - There is no price floor (Q-T03): the only rule is a whole number of cents above zero. A pre-release part has no price.
 *
 * Key scheme: `<sku>__base-eur-de`, `<sku>__base-usd-us`, `<sku>__<channelKey>` (EUR), `<sku>__<channelKey>__usd` (USD);
 * the channel scheme is the one workstream T writes (`<sku>__<channelKey>`). Keys start with the SKU, not `mau-`, so
 * `reset` identifies them by SKU and pattern (`isSeedPriceKey`).
 */
export interface PriceDef {
  key: string;
  sku: string;
  currency: 'EUR' | 'USD';
  country: 'DE' | 'US';
  cents: number;
  channelKey?: string;
}

const countryOf = (currency: 'EUR' | 'USD'): 'DE' | 'US' => (currency === 'EUR' ? 'DE' : 'US');
export const baseKey = (sku: string, currency: 'EUR' | 'USD'): string => `${sku}__base-${currency.toLowerCase()}-${countryOf(currency).toLowerCase()}`;
export const channelPriceKey = (sku: string, channelKey: string, currency: 'EUR' | 'USD'): string => `${sku}__${channelKey}${currency === 'USD' ? '__usd' : ''}`;

/** Master list price in EUR cents of a priced item (undefined: pre-release or unknown). */
export function listEur(sku: string): number | undefined {
  const p = PARTS.find((x) => x.sku === sku);
  if (p) return p.eur ?? undefined;
  const l = LOCAL_PARTS.find((x) => x.sku === sku);
  if (l) return l.eur;
  const b = BUNDLES.find((x) => x.sku === sku);
  return b ? bundleEur(b) : undefined;
}

const index = (sku: string): number => {
  const i = PARTS.findIndex((p) => p.sku === sku);
  return i >= 0 ? i : [...LOCAL_PARTS.map((l) => l.sku), ...BUNDLES.map((b) => b.sku)].indexOf(sku) + 7;
};

const def = (sku: string, currency: 'EUR' | 'USD', cents: number, channelKey?: string): PriceDef => ({
  key: channelKey ? channelPriceKey(sku, channelKey, currency) : baseKey(sku, currency), sku, currency, country: countryOf(currency), cents, ...(channelKey ? { channelKey } : {}),
});

export function priceDefs(): PriceDef[] {
  const out: PriceDef[] = [];
  const north = new Set(assortmentSkus(K.storeNorth));
  const south = new Set(assortmentSkus(K.storeSouth));

  // Malva base prices and reseller retail prices of master items
  const master = [...PARTS.filter((p) => p.eur !== null).map((p) => p.sku), ...BUNDLES.filter((b) => !b.owner).map((b) => b.sku)];
  for (const sku of master) {
    const eur = listEur(sku) as number;
    const usd = usdFromEur(eur);
    out.push(def(sku, 'EUR', eur), def(sku, 'USD', usd));
    for (const [channel, set] of [[K.distNorth, north], [K.distSouth, south]] as const) {
      if (!set.has(sku)) continue;
      for (const o of retailOverrides(channel, index(sku), eur, usd)) out.push(def(sku, o.currency, o.cents, channel));
    }
  }

  // Reseller-owned items: only a channel price on the owner's distribution channel
  const owned = [...LOCAL_PARTS.map((l) => ({ sku: l.sku, owner: l.owner })), ...BUNDLES.filter((b) => b.owner).map((b) => ({ sku: b.sku, owner: b.owner as string }))];
  for (const { sku, owner } of owned) {
    const eur = listEur(sku) as number;
    const channel = owner === K.storeNorth ? K.distNorth : K.distSouth;
    out.push(def(sku, 'EUR', eur, channel));
    if (channel === K.distSouth) out.push(def(sku, 'USD', usdFromEur(eur), channel));
  }

  // Branch prices (Q-005): the branch's own price in the branch's currency
  for (const b of BRANCHES) {
    const currency = b.country === 'DE' ? 'EUR' : 'USD';
    for (const sku of assortmentSkus(b.store)) {
      const eur = listEur(sku);
      if (eur === undefined || hash(`price:${sku}@${b.key}`) % 7 !== 0) continue;
      const factor = [0.97, 1.02, 1.04][hash(`factor:${sku}@${b.key}`) % 3] as number;
      out.push(def(sku, currency, round10((currency === 'EUR' ? eur : usdFromEur(eur)) * factor), b.key));
    }
  }
  return out;
}

export const priceDraft = (d: PriceDef): StandalonePriceDraft => ({
  key: d.key, sku: d.sku, value: { currencyCode: d.currency, centAmount: d.cents }, country: d.country,
  ...(d.channelKey ? { channel: { typeId: 'channel', key: d.channelKey } } : {}),
});

export const standalonePriceDrafts = (): StandalonePriceDraft[] => priceDefs().map(priceDraft);

/** True for a key of the scheme above whose SKU is one the seed owns (the only standalone prices `reset` may delete). */
export function isSeedPriceKey(key: string, sku: string): boolean {
  const seeded = PARTS.some((p) => p.sku === sku) || LOCAL_PARTS.some((l) => l.sku === sku) || BUNDLES.some((b) => b.sku === sku);
  return seeded && new RegExp(`^${sku}__(base-(eur-de|usd-us)|mau-[a-z0-9-]+(__usd)?)$`).test(key);
}
