/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { refersTo } from '@/lib/offers/refs';
import type { CompatVerdict, Money, Offer, Reason, VerdictStatus } from '@/lib/types';
import { apiFamilyOf, type ApiFamily } from './filters';

// Pure. What the offer APIs say about an offer, a verdict and a price. The same shapes serve the list, the detail and the finder.

export interface OfferItem {
  key: string;
  /** The master variant's SKU: what a cart add of this offer sends. */
  sku: string | null;
  name: string;
  kind: Offer['kind'];
  family: ApiFamily | null;
  /** Equipment only: the kind (router, modem, ...). A plan holds one item per kind. */
  equipmentKind: string | null;
  description: string;
  image?: string;
  /** The buyer's prices for the market, customer group and channel (the master variant). */
  price: { recurring?: Money; oneTime?: Money };
  /** `recurring` when the offer has a monthly price, else `one-time`. */
  chargeKind: 'recurring' | 'one-time';
  /** The first-order promotion: the first month is free. */
  firstMonthFree: boolean;
  termMonths: number | null;
  badge?: 'most-popular';
  /** Keys of the offers this one includes (resolved). */
  includedOffers: string[];
  /** Sold in selected regions only and the buyer has given no location: shown with "enter your ZIP", not addable yet. */
  needsLocation: boolean;
}

export interface VerdictReasonView {
  code: Reason['code'];
  message: string;
}

export interface VerdictView {
  status: VerdictStatus;
  reasons: VerdictReasonView[];
  /** Offers to add together with this one (it requires them and they are not in the cart or held). */
  requires?: { offerKey: string; name: string }[];
}

export interface GroupItem {
  offer: OfferItem;
  verdict: VerdictView;
}

export interface OfferDetail {
  offer: OfferItem;
  included: GroupItem[];
  compatibleAddons: GroupItem[];
  compatibleEquipment: GroupItem[];
}

export function toOfferItem(offer: Offer, offersByKey: Record<string, Offer>, options: { needsLocation?: boolean } = {}): OfferItem {
  const master = offer.variants.find((variant) => variant.isMaster) ?? offer.variants[0];
  const price: OfferItem['price'] = {
    ...(master?.recurringPrice ? { recurring: master.recurringPrice } : {}),
    ...(master?.oneTimePrice ? { oneTime: master.oneTimePrice } : {}),
  };
  const facts = offer.facts?.kind === 'plan' ? offer.facts : null;
  return {
    key: offer.key,
    sku: master?.sku ?? null,
    name: offer.name,
    kind: offer.kind,
    family: apiFamilyOf(offer),
    equipmentKind: offer.facts?.kind === 'equipment' ? offer.facts.equipmentKind : null,
    description: offer.description,
    ...(offer.image ? { image: offer.image } : {}),
    price,
    chargeKind: price.recurring ? 'recurring' : 'one-time',
    firstMonthFree: offer.firstMonthFree === true,
    termMonths: master?.termMonths ?? null,
    ...(facts?.badge ? { badge: facts.badge } : {}),
    includedOffers: offer.includedOffers.flatMap((ref) => {
      const found = Object.values(offersByKey).find((candidate) => refersTo(ref, candidate));
      return found ? [found.key] : [];
    }),
    needsLocation: options.needsLocation === true,
  };
}

export function toVerdictView(verdict: CompatVerdict, text: (reason: Reason) => string, requires: { offerKey: string; name: string }[] = []): VerdictView {
  return {
    status: verdict.status,
    reasons: verdict.reasons.map((reason) => ({ code: reason.code, message: text(reason) })),
    ...(requires.length > 0 ? { requires } : {}),
  };
}
