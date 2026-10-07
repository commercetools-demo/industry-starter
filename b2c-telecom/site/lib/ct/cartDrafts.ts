import 'server-only';
import type { Cart as CtCart, CartDraft, CartUpdateAction, LineItemDraft } from '@commercetools/platform-sdk';
import { ACTIVATION_FEE_NAME, ACTIVATION_FEE_SLUG_PREFIX, ACTIVATION_FEE_TAX_CATEGORY_KEY, PROBE_CART_DELETE_DAYS } from '@/lib/config/cart';
import { lineRecurrence, type MonthlyLineKind } from '@/lib/pricing/priceMode';
import type { Market, Money, Offer, OfferVariant, TermMonths } from '@/lib/types';
import { recurrenceInfoDraft } from './recurring';

// Update actions and drafts of the cart. One builder serves real adds and the probe carts of the discount prompt, so a quoted saving
// is priced from exactly the line shape a real add produces.

/** A line is recurring when the variant has a monthly price. Devices keep their financed prices (Q); outright purchase is one-time. */
export function isRecurringVariant(offer: Offer, variant: OfferVariant): boolean {
  return offer.kind !== 'device' && variant.recurringPrice !== undefined;
}

function monthlyKind(offer: Offer): MonthlyLineKind {
  if (offer.kind === 'addon') return 'addon';
  if (offer.kind === 'equipment') return 'equipment-rental';
  return 'plan';
}

export interface LineDraftArgs {
  offer: Offer;
  variant: OfferVariant;
  quantity: number;
  parentLineId?: string | undefined;
}

type AddLineItemAction = Extract<CartUpdateAction, { action: 'addLineItem' }>;

/** `addLineItem` with `recurrenceInfo` for monthly lines (none for one-time lines) and the `malva-line-item` custom fields. */
export function addLineItemAction({ offer, variant, quantity, parentLineId }: LineDraftArgs): AddLineItemAction {
  const fields: Record<string, string> = { offerKey: offer.key };
  if (parentLineId) fields.parentLineItemId = parentLineId;
  return {
    action: 'addLineItem',
    sku: variant.sku,
    quantity,
    ...(isRecurringVariant(offer, variant) ? { recurrenceInfo: recurrenceInfoDraft(lineRecurrence(monthlyKind(offer), (variant.termMonths ?? 0) as TermMonths)) } : {}),
    custom: { type: { typeId: 'type', key: 'malva-line-item' }, fields },
  };
}

export const feeSlug = (offerKey: string): string => `${ACTIVATION_FEE_SLUG_PREFIX}${offerKey}`;

/** The activation fee of a plan: its variant's one-time price when it also has a monthly price (cable). null when there is none. */
export function activationFeeOf(offer: Offer, variant: OfferVariant): Money | null {
  const isPlan = offer.kind === 'base-package' || offer.kind === 'bundle';
  return isPlan && variant.recurringPrice && variant.oneTimePrice && variant.oneTimePrice.centAmount > 0 ? variant.oneTimePrice : null;
}

/** One-time activation fee as a custom line item (slug = `activation-fee:<offerKey>`, quantity follows the plan). */
export function addFeeAction(offerKey: string, quantity: number, fee: Money): CartUpdateAction {
  return {
    action: 'addCustomLineItem',
    name: { ...ACTIVATION_FEE_NAME },
    slug: feeSlug(offerKey),
    quantity,
    money: { type: 'centPrecision', currencyCode: fee.currencyCode, centAmount: fee.centAmount },
    taxCategory: { typeId: 'tax-category', key: ACTIVATION_FEE_TAX_CATEGORY_KEY },
  };
}

const lineDraftOf = (action: AddLineItemAction): LineItemDraft => {
  const { action: _action, ...draft } = action;
  void _action;
  return draft;
};

/**
 * The draft of a throwaway "probe" cart: a copy of the buyer's cart (same market, owner, lines, fee lines and discount codes) plus the
 * candidate line built by the SAME builder as a real add, so the saving read from it is exactly what the real add later produces.
 * The candidate merges into an identical existing line (a phone plan again). `origin: Merchant` keeps probes out of the customer's carts.
 */
export function buildProbeDraft(cart: CtCart, market: Market, candidate: LineDraftArgs, key: string): CartDraft {
  const lines: LineItemDraft[] = cart.lineItems.map((line) => {
    const fields = (line.custom?.fields ?? {}) as Record<string, unknown>;
    const text = (name: string): string | undefined => (typeof fields[name] === 'string' ? (fields[name] as string) : undefined);
    return {
      sku: line.variant.sku ?? '',
      quantity: line.quantity,
      ...(line.recurrenceInfo
        ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy' as const, id: line.recurrenceInfo.recurrencePolicy.id }, priceSelectionMode: line.recurrenceInfo.priceSelectionMode } }
        : {}),
      custom: { type: { typeId: 'type' as const, key: 'malva-line-item' }, fields: { ...(text('offerKey') ? { offerKey: text('offerKey') } : {}), ...(text('parentLineItemId') ? { parentLineItemId: text('parentLineItemId') } : {}) } },
    };
  });
  const added = lineDraftOf(addLineItemAction(candidate));
  const same = lines.find((line) => line.sku === added.sku && JSON.stringify(line.custom?.fields) === JSON.stringify(added.custom?.fields));
  const withCandidate: LineItemDraft[] = same ? lines.map((line) => (line === same ? { ...line, quantity: (line.quantity ?? 1) + (added.quantity ?? 1) } : line)) : [...lines, added];
  const codes = cart.discountCodes.flatMap((info) => (info.discountCode.obj?.code ? [info.discountCode.obj.code] : []));
  return {
    key,
    currency: market.currency,
    country: market.country,
    locale: market.locale,
    taxMode: 'Platform',
    inventoryMode: 'None',
    origin: 'Merchant',
    deleteDaysAfterLastModification: PROBE_CART_DELETE_DAYS,
    ...(cart.customerId ? { customerId: cart.customerId } : { anonymousId: cart.anonymousId ?? `probe-${key}` }),
    lineItems: withCandidate,
    customLineItems: cart.customLineItems.map((item) => ({
      name: item.name,
      slug: item.slug,
      quantity: item.quantity,
      money: { currencyCode: item.money.currencyCode, centAmount: item.money.centAmount },
      taxCategory: { typeId: 'tax-category' as const, key: ACTIVATION_FEE_TAX_CATEGORY_KEY },
    })),
    ...(codes.length > 0 ? { discountCodes: codes } : {}),
    custom: { type: { typeId: 'type', key: 'malva-order' }, fields: {} },
  };
}
