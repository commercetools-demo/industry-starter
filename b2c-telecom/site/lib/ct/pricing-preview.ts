/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { guardAdd, type GuardLine } from '@/lib/cart/guard';
import { includedLinesOf } from '@/lib/cart/included';
import { checkQuantity } from '@/lib/cart/quantity';
import { dependentQuantity } from '@/lib/offers/addons';
import { cartGroupKeyOf } from '@/lib/offers/declared';
import { negatedLines } from '@/lib/offers/dependencies';
import { resolveVisibleOffer } from '@/lib/offers/eligibility';
import { OffersApiError } from '@/lib/offers-api/errors';
import type { PreviewIssue, PreviewLine, PreviewRequest, PreviewResult } from '@/lib/offers-api/preview';
import { reasonTextFor } from '@/lib/offers-api/text';
import { mapCart } from '@/lib/mappers/cart';
import { PREVIEW_PROBE_KEY_PREFIX } from '@/lib/config/cart';
import { toDateOnly } from '@/lib/pricing/dates';
import type { SessionData } from '@/lib/session-types';
import type { BuyerContext, Locale, Market, Offer, OfferVariant } from '@/lib/types';
import { getBuyerContext } from './buyer-context';
import { activationFeeOf, addLineItemAction, buildPreviewDraft } from './cartDrafts';
import { getActiveCartForSession } from './cart';
import { getAllOffers } from './catalog';
import { getCartDiscountKeys, getCartDiscountNames } from './discount-keys';
import { distributionChannelOf, priceScopeOf } from './price-scope';
import { probeKey, withProbeCart } from './probe';

// POST /api/pricing/preview: the price of a plan and its extras, read from the commercetools engine in ONE throwaway cart that is deleted
// afterwards. The cart is built by the same builders a real add uses and read by the same mapper the bundle uses, so what it says is what
// /bundle shows once the same items are added. Nothing is persisted and the buyer's own cart is only read (its discount codes apply).

export type { PreviewIssue, PreviewLine, PreviewResult };

const variantOf = (offer: Offer, sku: string | undefined): OfferVariant | undefined => (sku ? offer.variants.find((entry) => entry.sku === sku) : (offer.variants.find((entry) => entry.isMaster) ?? offer.variants[0]));

interface Accepted {
  offer: Offer;
  variant: OfferVariant;
}

export async function previewPricing(session: SessionData, market: Market, request: PreviewRequest): Promise<PreviewResult> {
  const buyer: BuyerContext = await getBuyerContext(market);
  const offers = await getAllOffers(market, priceScopeOf(buyer));
  const offersByKey = Object.fromEntries(offers.map((offer) => [offer.key, offer]));
  const text = reasonTextFor(market.locale as Locale);

  // The plan: it must exist, be visible to this buyer, be a plan, have the sku and a quantity its rule accepts.
  const plan = resolveVisibleOffer(offersByKey, request.planKey, buyer).offer;
  if (!plan || (plan.kind !== 'base-package' && plan.kind !== 'bundle')) throw new OffersApiError('INVALID_PLAN', 'That plan is not available.', { field: 'planKey' });
  const planVariant = variantOf(plan, request.sku);
  if (!planVariant || !planVariant.recurringPrice) throw new OffersApiError('INVALID_PLAN', 'That plan variant is not available.', { field: 'sku' });
  const limit = checkQuantity(plan, request.quantity);
  if (limit) throw new OffersApiError('INVALID_QUANTITY', 'That number of lines is not available for this plan.', { field: 'quantity' });

  const planLine: GuardLine = { lineItemId: 'plan', offerKey: plan.key, sku: planVariant.sku, quantity: request.quantity };
  const planGuard = guardAdd({ candidate: plan, sku: planVariant.sku, quantity: request.quantity, lines: [], offersByKey, buyer });
  if (!planGuard.allowed) {
    throw new OffersApiError('INVALID_PLAN', 'That plan cannot be bought in this context.', { field: 'planKey', reasons: planGuard.blocked.reasons.map((reason) => ({ code: reason.code, message: text({ ...reason, code: reason.code as never }) })) });
  }

  const resolve = (selection: { offer: Offer; variant: OfferVariant }): Accepted => ({ offer: selection.offer, variant: selection.variant });
  const equipment = planGuard.equipment.flatMap((selection) => {
    const offer = offersByKey[selection.offerKey];
    const variant = offer?.variants.find((entry) => entry.sku === selection.variantSku);
    return offer && variant ? [resolve({ offer, variant })] : [];
  });
  const included = includedLinesOf(plan, offersByKey, equipment);

  // Extras one after another against what is accepted so far, like the real cart: refused ones are reported, the rest are priced.
  const issues: PreviewIssue[] = [];
  const replaced: string[] = [];
  let lines: GuardLine[] = [planLine];
  let accepted: Accepted[] = [];
  for (const [index, extra] of request.extras.entries()) {
    const offer = offersByKey[extra.offerKey];
    const variant = offer ? variantOf(offer, extra.sku) : undefined;
    if (!offer || !variant || offer.kind === 'base-package' || offer.kind === 'bundle' || offer.kind === 'device') {
      issues.push({ offerKey: extra.offerKey, name: offer?.name ?? extra.offerKey, kind: 'unavailable', reasons: [{ code: 'OFFER_NOT_FOUND', message: text({ code: 'OFFER_NOT_FOUND', messageKey: 'offers.reason.OFFER_NOT_FOUND', params: {}, offerKeys: [extra.offerKey] }) }] });
      continue;
    }
    // An extra that negates another replaces it (professional installation replaces the self-install kit), as the real add does.
    const negated = negatedLines(offer, lines, offersByKey).filter((entry) => entry.declaredBy === 'candidate');
    const gone = new Set(negated.map((entry) => entry.line.lineItemId));
    const remaining = lines.filter((line) => !gone.has(line.lineItemId));
    const quantity = dependentQuantity(request.quantity);
    const guard = guardAdd({ candidate: offer, sku: variant.sku, quantity, parentLineId: 'plan', lines: remaining, offersByKey, buyer });
    if (!guard.allowed) {
      issues.push({ offerKey: offer.key, name: offer.name, kind: 'blocked', reasons: guard.blocked.reasons.map((reason) => ({ code: reason.code, message: text({ ...reason, code: reason.code as never }) })) });
      continue;
    }
    lines = [...remaining, { lineItemId: `extra-${index}`, offerKey: offer.key, sku: variant.sku, quantity, parentLineItemId: 'plan' }];
    accepted = [...accepted.filter((entry) => !negated.some((gone2) => gone2.offer.key === entry.offer.key)), { offer, variant }];
    for (const entry of negated) replaced.push(entry.offer.name);
  }

  const channelKey = distributionChannelOf(buyer);
  const fee = activationFeeOf(plan, planVariant);
  const cart = await getActiveCartForSession(session, market).catch(() => null);
  const codes = (cart?.discountCodes ?? []).flatMap((info) => (info.state === 'MatchesCart' && info.discountCode.obj?.code ? [info.discountCode.obj.code] : []));
  const draft = buildPreviewDraft({
    market,
    key: probeKey(PREVIEW_PROBE_KEY_PREFIX),
    plan: { offer: plan, variant: planVariant, quantity: request.quantity, channelKey },
    fee: fee ? { centAmount: fee.centAmount * request.quantity, currencyCode: fee.currencyCode } : null,
    buyer: { customerId: session.customerId, groupKey: cartGroupKeyOf(buyer) },
    discountCodes: codes,
  });
  // The children (required equipment, included offers, extras) are written after the plan, as a real add does, so they carry its line id.
  const children: { offer: Offer; variant: OfferVariant; free: boolean; quantity: number }[] = [
    ...equipment.map((entry) => ({ ...entry, free: false, quantity: 1 })),
    ...included.map((entry) => ({ ...entry, free: true, quantity: dependentQuantity(request.quantity) })),
    ...accepted.map((entry) => ({ ...entry, free: false, quantity: dependentQuantity(request.quantity) })),
  ];

  const discountKeyById = await getCartDiscountKeys();
  const discountNameById = await getCartDiscountNames();
  const priced = await withProbeCart(draft, async (probe, tools) => {
    const planItem = probe.lineItems[0];
    if (!planItem) throw new OffersApiError('UPSTREAM_UNAVAILABLE', 'The price could not be read.');
    if (children.length === 0) return probe;
    return tools.update(children.map((child) => addLineItemAction({ offer: child.offer, variant: child.variant, quantity: child.quantity, parentLineId: planItem.id, free: child.free, channelKey })));
  });

  const mapped = mapCart(priced, market, { offersByKey, stock: {}, issues: [], today: toDateOnly(new Date()), discountKeyById, discountNameById });
  return {
    dueToday: mapped.summary.dueToday,
    thenMonthly: mapped.summary.thenMonthly,
    summary: mapped.summary,
    lines: mapped.lines
      .filter((line) => line.kind !== 'fee')
      .map((line) => ({ offerKey: line.offerKey, sku: line.sku, kind: line.kind, name: line.name, quantity: line.quantity, chargeType: line.chargeType, unitListPrice: line.unitListPrice, total: line.total, includedAtNoCharge: line.includedAtNoCharge })),
    promotions: [...mapped.lines.flatMap((line) => line.promotions ?? []), ...mapped.promotions],
    issues,
    replaced,
  };
}
