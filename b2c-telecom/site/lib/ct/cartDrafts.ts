import 'server-only';
import type { CartUpdateAction } from '@commercetools/platform-sdk';
import { ACTIVATION_FEE_NAME, ACTIVATION_FEE_SLUG_PREFIX, ACTIVATION_FEE_TAX_CATEGORY_KEY } from '@/lib/config/cart';
import { lineRecurrence, type MonthlyLineKind } from '@/lib/pricing/priceMode';
import type { Money, Offer, OfferVariant, TermMonths } from '@/lib/types';
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
