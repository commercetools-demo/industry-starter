/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import type { Cart as CtCart, CustomLineItem, LineItem } from '@commercetools/platform-sdk';
import { ACTIVATION_FEE_SLUG_PREFIX } from '@/lib/config/cart';
import { MONTHLY_POLICY_KEY } from '@/lib/config/pricing';
import { getMinimumOrder, shortfall } from '@/lib/cart/minimum';
import { readAcquisition } from '@/lib/devices/acquisition';
import { devicePricesOf } from '@/lib/mappers/device';
import { refersTo } from '@/lib/offers/refs';
import { getLocalizedString } from '@/lib/format';
import { buildLabel, formatLabelMoney } from '@/lib/pricing/label';
import { LABEL_STRINGS } from '@/lib/pricing/labelStrings';
import { discountKeyFor, introDefFor } from '@/lib/pricing/introPeriod';
import { buildSchedule } from '@/lib/pricing/schedule';
import { taxAddedOf, thenMonthlyOf } from '@/lib/pricing/summary';
import type {
  BundleIssue,
  BundleLineKind,
  Cart,
  CartDiscountCodeInfo,
  CartLine,
  AppliedPromotion,
  CartSummary,
  DiscountCodeReason,
  Locale,
  Money,
  Offer,
  TermMonths,
} from '@/lib/types';

export interface CartMapContext {
  locale: Locale;
  currency: 'USD' | 'EUR';
  country: 'US' | 'DE';
}

export interface CartMapDeps {
  offersByKey: Record<string, Offer>;
  /** Available quantity by SKU, for the equipment and device lines that were checked. */
  stock: Record<string, number>;
  /** J/K revalidation issues, already mapped. */
  issues: BundleIssue[];
  /** YYYY-MM-DD (UTC) of the request. */
  today: string;
  /** Cart Discount id to key (references in a cart carry the id only). */
  discountKeyById: Record<string, string>;
  /** Cart Discount id to its localized name, for the list of promotions (a missing name falls back to the key). */
  discountNameById?: Record<string, Record<string, string>>;
  /** Recurrence policy id to key of the device policies (workstream Q); only needed when the cart has a device line. */
  devicePolicyKeys?: Record<string, string>;
}

const zero = (currencyCode: string): Money => ({ centAmount: 0, currencyCode });
const add = (a: Money, b: Money): Money => ({ centAmount: a.centAmount + b.centAmount, currencyCode: a.currencyCode });
const money = (value: { centAmount: number; currencyCode: string }): Money => ({ centAmount: value.centAmount, currencyCode: value.currencyCode });

function fieldText(fields: Record<string, unknown> | undefined, name: string): string | undefined {
  const value = fields?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const KIND_OF_OFFER: Record<Offer['kind'], BundleLineKind> = { 'base-package': 'plan', bundle: 'plan', addon: 'addon', equipment: 'equipment', device: 'device' };

const CODE_STATES: Record<string, { state: CartDiscountCodeInfo['state']; reason: DiscountCodeReason | null }> = {
  MatchesCart: { state: 'applied', reason: null },
  DoesNotMatchCart: { state: 'not-applicable', reason: 'not-applicable' },
  NotActive: { state: 'not-active', reason: 'not-active' },
  NotValid: { state: 'not-valid', reason: 'not-valid' },
  MaxApplicationReached: { state: 'max-reached', reason: 'max-reached' },
  ApplicationStoppedByPreviousDiscount: { state: 'stopped', reason: 'stopped' },
  ApplicationStoppedByGroupBestDeal: { state: 'stopped', reason: 'stopped' },
};

/** Exported for the discount-code route: the same table gives the reason of a refused code. */
export function codeStateInfo(state: string): { state: CartDiscountCodeInfo['state']; reason: DiscountCodeReason | null } {
  return CODE_STATES[state] ?? { state: 'not-applicable', reason: 'not-applicable' };
}

function discountKeys(line: LineItem, deps: CartMapDeps): string[] {
  const keys = new Set<string>();
  for (const portion of line.discountedPricePerQuantity ?? []) {
    for (const included of portion.discountedPrice.includedDiscounts) {
      const key = deps.discountKeyById[included.discount.id];
      if (key) keys.add(key);
    }
  }
  return [...keys];
}

/** What the engine took off a line: discounted amount of every included discount times the quantity of its portion. */
function engineDiscountOf(line: LineItem | CustomLineItem): number {
  let total = 0;
  for (const portion of line.discountedPricePerQuantity ?? []) {
    for (const included of portion.discountedPrice.includedDiscounts) total += included.discountedAmount.centAmount * portion.quantity;
  }
  return total;
}

interface Reduction {
  discountId: string;
  /** Total off, over every unit it reached. */
  cents: number;
  lineId: string | null;
}

/** Every reduction the engine reports: per line (discountedPricePerQuantity x quantity of the portion) and on the order total. */
function reductionsOf(ct: CtCart): Reduction[] {
  const out: Reduction[] = [];
  for (const line of [...ct.lineItems, ...ct.customLineItems]) {
    for (const portion of line.discountedPricePerQuantity ?? []) {
      for (const included of portion.discountedPrice.includedDiscounts) {
        out.push({ discountId: included.discount.id, cents: included.discountedAmount.centAmount * portion.quantity, lineId: line.id });
      }
    }
  }
  for (const included of ct.discountOnTotalPrice?.includedDiscounts ?? []) out.push({ discountId: included.discount.id, cents: included.discountedAmount.centAmount, lineId: null });
  return out.filter((reduction) => reduction.cents > 0);
}

/** One entry per promotion: its name, the amount off in total and the lines it reduced. */
function promotionsOf(ct: CtCart, deps: CartMapDeps, locale: string, currency: string): AppliedPromotion[] {
  const byDiscount = new Map<string, AppliedPromotion>();
  for (const reduction of reductionsOf(ct)) {
    const key = deps.discountKeyById[reduction.discountId] ?? reduction.discountId;
    const entry = byDiscount.get(reduction.discountId) ?? { key, name: getLocalizedString(deps.discountNameById?.[reduction.discountId], locale) || key, amount: zero(currency), lineIds: [] };
    entry.amount = { centAmount: entry.amount.centAmount + reduction.cents, currencyCode: currency };
    if (reduction.lineId !== null && !entry.lineIds.includes(reduction.lineId)) entry.lineIds.push(reduction.lineId);
    byDiscount.set(reduction.discountId, entry);
  }
  return [...byDiscount.values()];
}

function issueFor(code: string, messageKey: string, line: Pick<CartLine, 'id' | 'offerKey'>, extra: Record<string, string | number> = {}): BundleIssue {
  return { code, severity: 'blocking', lineId: line.id, offerKey: line.offerKey, resolution: 'none', reasons: [{ code, messageKey, params: extra, offerKeys: [line.offerKey] }] };
}

/** Color, memory and prices per mode of a device line's variant (Q); empty when the variant lacks a color or a memory. */
function deviceOf(variant: Offer['variants'][number], deps: CartMapDeps): { device?: NonNullable<CartLine['device']> } {
  const color = variant.attributes.color;
  const memoryGb = Number(variant.attributes['memory-gb']);
  if (typeof color !== 'string' || !Number.isFinite(memoryGb)) return {};
  return { device: { color, memoryGb, prices: devicePricesOf(variant, deps.devicePolicyKeys ?? {}) } };
}

export function mapCart(ct: CtCart, ctx: CartMapContext, deps: CartMapDeps): Cart {
  const currency = ct.totalPrice.currencyCode;
  const issues: BundleIssue[] = [...deps.issues];

  const feeItems = ct.customLineItems.filter((item) => item.slug.startsWith(ACTIVATION_FEE_SLUG_PREFIX));
  const feeOf = (offerKey: string): CustomLineItem | undefined => feeItems.find((item) => item.slug === `${ACTIVATION_FEE_SLUG_PREFIX}${offerKey}`);

  // First pass: the line items without schedule and label (they need their children).
  // Lines keep the order in which they were first added: a device re-added in another mode carries its old `addedAt` (Q, verified live).
  const ordered = [...ct.lineItems].sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? ''));
  const base: CartLine[] = ordered.map((item): CartLine => {
    const taken = engineDiscountOf(item);
    const fields = item.custom?.fields as Record<string, unknown> | undefined;
    const offerKey = fieldText(fields, 'offerKey') ?? item.productKey ?? '';
    const offer = deps.offersByKey[offerKey];
    const sku = item.variant.sku ?? null;
    const variant = offer?.variants.find((candidate) => candidate.sku === sku);
    const kind: BundleLineKind = offer ? KIND_OF_OFFER[offer.kind] : 'addon';
    const facts = offer?.facts ?? null;
    const planFacts = facts?.kind === 'plan' ? facts : null;
    const total = money(item.totalPrice);
    const unitListPrice = money(item.price.value);
    const recurring = item.recurrenceInfo !== undefined;
    const quantity = item.quantity;
    // Q: how a device is acquired is read from the line fields, never inferred from its price. A financed device line is not a service line.
    const acquisition = readAcquisition(fields);
    return {
      id: item.id,
      source: 'line-item',
      offerKey,
      sku,
      kind,
      name: offer?.name ?? getLocalizedString(item.name as Record<string, string>, ctx.locale),
      family: planFacts?.family ?? null,
      technology: planFacts?.technology ?? null,
      ...(offer?.image ? { imageUrl: offer.image } : {}),
      bullets: (planFacts?.highlights ?? (facts?.kind === 'addon' ? facts.highlights : [])).slice(0, 3),
      description: offer?.description ?? '',
      quantity,
      termMonths: (variant?.termMonths ?? 0) as TermMonths,
      chargeType: recurring ? 'recurring' : 'one-time',
      recurrence: item.recurrenceInfo && !acquisition ? { policyKey: MONTHLY_POLICY_KEY, priceSelectionMode: item.recurrenceInfo.priceSelectionMode === 'Fixed' ? 'Fixed' : 'Dynamic' } : null,
      unitListPrice,
      unitPrice: { centAmount: quantity > 0 ? Math.round(total.centAmount / quantity) : total.centAmount, currencyCode: total.currencyCode },
      ...(taken > 0 && item.quantity > 0 ? { promoPerUnit: money({ ...item.totalPrice, centAmount: Math.round(taken / item.quantity) }) } : {}),
      total,
      appliedDiscountKeys: discountKeys(item, deps),
      parentLineId: fieldText(fields, 'parentLineItemId') ?? null,
      includedAtNoCharge: false,
      requiredEquipment: false,
      schedule: null,
      label: null,
      stock: null,
      ...(acquisition ? { acquisition } : {}),
      ...(acquisition && variant ? deviceOf(variant, deps) : {}),
    };
  });

  const planLineOf = (offerKey: string): CartLine | undefined => base.find((line) => line.kind === 'plan' && line.offerKey === offerKey);

  const feeLines: CartLine[] = feeItems.map((item): CartLine => {
    const offerKey = item.slug.slice(ACTIVATION_FEE_SLUG_PREFIX.length);
    const total = money(item.totalPrice);
    return {
      id: item.id,
      source: 'custom-line-item',
      offerKey,
      sku: null,
      kind: 'fee',
      name: getLocalizedString(item.name as Record<string, string>, ctx.locale),
      family: null,
      technology: null,
      bullets: [],
      description: '',
      quantity: item.quantity,
      termMonths: 0,
      chargeType: 'one-time',
      recurrence: null,
      unitListPrice: money(item.money),
      unitPrice: { centAmount: item.quantity > 0 ? Math.round(total.centAmount / item.quantity) : total.centAmount, currencyCode: total.currencyCode },
      total,
      appliedDiscountKeys: [],
      parentLineId: planLineOf(offerKey)?.id ?? null,
      includedAtNoCharge: false,
      requiredEquipment: false,
      schedule: null,
      label: null,
      stock: null,
    };
  });

  const byId = new Map(base.map((line) => [line.id, line]));
  const lines: CartLine[] = base.map((line) => {
    const offer = deps.offersByKey[line.offerKey];
    const parent = line.parentLineId ? byId.get(line.parentLineId) : undefined;
    const parentOffer = parent ? deps.offersByKey[parent.offerKey] : undefined;
    const next: CartLine = { ...line };

    if (offer && parentOffer && (line.kind === 'addon' || line.kind === 'equipment')) {
      next.includedAtNoCharge = parentOffer.includedOffers.some((ref) => refersTo(ref, offer)) && line.total.centAmount === 0;
      if (line.kind === 'equipment' && offer.facts?.kind === 'equipment' && parentOffer.facts?.kind === 'plan') {
        next.requiredEquipment = parentOffer.facts.requiredEquipmentKinds.includes(offer.facts.equipmentKind);
      }
    }

    if ((line.kind === 'equipment' || line.kind === 'device') && line.sku) {
      const available = deps.stock[line.sku];
      if (available !== undefined) {
        next.stock = { available, inStock: available >= line.quantity };
        if (available < line.quantity) {
          issues.push(issueFor('OUT_OF_STOCK', 'bundle.issue.outOfStock', line));
        }
      }
    }

    if (line.kind === 'plan' && line.chargeType === 'recurring' && offer && line.sku) {
      const fee = feeOf(line.offerKey);
      const variant = offer.variants.find((candidate) => candidate.sku === line.sku);
      const monthToMonth = offer.variants.find((candidate) => candidate.termMonths === 0 && candidate.recurringPrice)?.recurringPrice ?? null;
      const introDef = introDefFor(line.offerKey, line.termMonths);
      const schedule = buildSchedule({
        offerKey: line.offerKey,
        sku: line.sku,
        termMonths: line.termMonths,
        quantity: line.quantity,
        standing: line.unitListPrice,
        introApplied: introDef !== null && line.appliedDiscountKeys.includes(discountKeyFor(introDef)),
        ...(line.promoPerUnit ? { firstOrderDiscount: line.promoPerUnit } : {}),
        monthToMonth,
        oneTimeDueNow: fee ? money(fee.totalPrice) : zero(currency),
        orderDate: deps.today,
      });
      if (schedule.ok) next.schedule = schedule.value;
      else issues.push(issueFor('SCHEDULE_NOT_PRICEABLE', 'bundle.issue.scheduleNotPriceable', line, { error: schedule.error.code }));

      const children = base
        .filter((child) => child.parentLineId === line.id)
        .map((child) => ({ name: child.name, chargeType: child.chargeType, kind: child.kind, total: child.total, quantity: child.quantity }));
      const label = buildLabel({
        offer,
        line: { sku: line.sku, quantity: line.quantity, termMonths: line.termMonths, unitListPrice: line.unitListPrice, unitPrice: line.unitPrice },
        activationFee: fee ? money(fee.money) : (variant?.oneTimePrice ?? zero(currency)),
        children,
        schedule: schedule.ok ? schedule.value : null,
        strings: LABEL_STRINGS,
        fmt: formatLabelMoney,
      });
      if (label.ok) next.label = label.label;
      else issues.push(issueFor('LABEL_DATA_MISSING', 'bundle.issue.labelMissing', line, { missing: label.missing.join(',') }));
    }
    return next;
  });

  const all = [...lines, ...feeLines];
  // A promotion that reduced exactly one line (and nothing else) sits under that line; any other is listed after the lines.
  const promotions = promotionsOf(ct, deps, ctx.locale, currency);
  const lineOnly = (promotion: AppliedPromotion): boolean => promotion.lineIds.length === 1 && !(ct.discountOnTotalPrice?.includedDiscounts ?? []).some((included) => (deps.discountKeyById[included.discount.id] ?? included.discount.id) === promotion.key);
  const underLine = new Map<string, AppliedPromotion[]>();
  for (const promotion of promotions.filter(lineOnly)) underLine.set(promotion.lineIds[0] as string, [...(underLine.get(promotion.lineIds[0] as string) ?? []), promotion]);
  const lineView = (line: CartLine): CartLine => (underLine.has(line.id) ? { ...line, promotions: underLine.get(line.id) } : line);
  const sum = (predicate: (line: CartLine) => boolean): Money => all.filter(predicate).reduce((acc, line) => add(acc, line.total), zero(currency));
  const discountOnLines = [...ct.lineItems, ...ct.customLineItems].reduce((acc, line) => acc + engineDiscountOf(line), 0);
  const discountOnTotal = ct.discountOnTotalPrice?.discountedAmount.centAmount ?? 0;
  const totalPrice = money(ct.totalPrice);
  const taxAdded = taxAddedOf(totalPrice, ct.taxedPrice ? money(ct.taxedPrice.totalGross) : null);
  const summary: CartSummary = {
    plans: sum((line) => line.chargeType === 'recurring' && line.kind === 'plan'),
    addons: sum((line) => line.chargeType === 'recurring' && (line.kind === 'addon' || line.kind === 'equipment')),
    devicesMonthly: sum((line) => line.chargeType === 'recurring' && line.kind === 'device'),
    monthly: sum((line) => line.chargeType === 'recurring'),
    oneTime: sum((line) => line.chargeType === 'one-time'),
    discountTotal: { centAmount: discountOnLines + discountOnTotal, currencyCode: currency },
    orderDiscount: { centAmount: discountOnTotal, currencyCode: currency },
    shipping: ct.shippingInfo ? money(ct.shippingInfo.price) : null,
    tax: ct.taxedPrice ? { centAmount: ct.taxedPrice.totalGross.centAmount - ct.taxedPrice.totalNet.centAmount, currencyCode: currency } : null,
    taxAdded,
    total: totalPrice,
    dueToday: taxAdded ? add(totalPrice, taxAdded) : totalPrice,
    thenMonthly: thenMonthlyOf(all, currency),
  };

  const discountCodes: CartDiscountCodeInfo[] = ct.discountCodes.map((info) => {
    const obj = info.discountCode.obj;
    return { code: obj?.code ?? info.discountCode.id, ...codeStateInfo(info.state) };
  });

  const required = getMinimumOrder(currency);
  // The order's value is what is due today or, when more, one month of what recurs: a plan with a free first month is not a $0 order.
  const worth = summary.thenMonthly.centAmount > summary.total.centAmount ? summary.thenMonthly : summary.total;
  const gap = shortfall(worth, currency);
  const blockedBy: Cart['checkoutBlockedBy'] = [];
  if (lines.length === 0) blockedBy.push('EMPTY');
  if (lines.length > 0 && gap) blockedBy.push('MINIMUM_ORDER');
  if (issues.length > 0) blockedBy.push('ISSUES');

  return {
    id: ct.id,
    version: ct.version,
    currencyCode: currency,
    country: ct.country ?? ctx.country,
    lines: all.map(lineView),
    // What the buyer chose: an included child line is part of its plan, not another item.
    itemCount: lines.filter((line) => !line.includedAtNoCharge).length,
    summary,
    discountCodes,
    promotions: promotions.filter((promotion) => !lineOnly(promotion)),
    minimumOrder: required ? { required, shortfall: lines.length > 0 ? gap : null } : null,
    issues,
    canCheckout: blockedBy.length === 0,
    checkoutBlockedBy: blockedBy,
    postalCode: fieldText(ct.custom?.fields as Record<string, unknown> | undefined, 'postalCode') ?? null,
  };
}
