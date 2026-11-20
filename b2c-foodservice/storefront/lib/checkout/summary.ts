import type { Cart, CheckoutIssue, DiscountCodeView, SummaryView } from '@/lib/types';
import { collectionOffered } from '@/lib/checkout/fulfilment-plan';

/**
 * Checkout summary (workstream K, 3.5). Every figure is read from the cart view, which reads the engine: no tax rate, no
 * threshold and no shipping price is a constant here. `subtotalCents` is the sum before cart discounts.
 */
export function buildSummary(cart: Cart): SummaryView {
  const discount = cart.discount?.centAmount ?? 0;
  const shipping = cart.shipping?.amount.centAmount ?? null;
  // `cart.total` is the taxed gross (which includes shipping) when the engine has one, else the goods total without shipping.
  const total = cart.tax ? cart.total.centAmount : cart.total.centAmount + (shipping ?? 0);
  return {
    currency: cart.currency,
    subtotalCents: cart.subtotal.centAmount + discount,
    discountCents: discount,
    shippingCents: shipping,
    shippingFree: cart.shipping?.isFree ?? false,
    taxCents: cart.tax?.amount.centAmount ?? null,
    totalCents: total,
    version: cart.version,
  };
}

/** What the cart view cannot say about a line: blocks and notices that checkout shows as issues (3.7 "Cart issues"). */
export function checkoutIssues(cart: Pick<Cart, 'lines' | 'country'>): CheckoutIssue[] {
  const issues: CheckoutIssue[] = [];
  const collect = collectionOffered(cart.country);
  for (const l of cart.lines) {
    if (l.fulfilment === 'collect' && !collect) issues.push({ code: 'collect_not_available', lineId: l.id });
    for (const n of l.notices) {
      if (n.kind === 'out-of-stock' || n.kind === 'quantity-exceeds-stock') issues.push({ code: 'line_unavailable', lineId: l.id });
      else if (n.kind === 'collect-unavailable') issues.push({ code: 'collect_out_of_stock', lineId: l.id });
      else if (n.kind === 'price-updated') issues.push({ code: 'price_changed', lineId: l.id });
    }
  }
  return issues;
}

/** Issues that stop the shopper (`price_changed` is a notice only). */
export function blockingIssues(issues: readonly CheckoutIssue[]): CheckoutIssue[] {
  return issues.filter((i) => i.code !== 'price_changed');
}

/** Structural subset of a commercetools cart that `codeSavings` reads (no SDK types outside lib/ct). */
interface MoneyLike { centAmount: number }
interface IncludedDiscountLike { discount: { id: string }; discountedAmount: MoneyLike }
export interface SavingsCart {
  lineItems: { discountedPricePerQuantity?: { quantity: number; discountedPrice: { includedDiscounts: IncludedDiscountLike[] } }[] }[];
  shipping?: { shippingInfo: { discountedPrice?: { includedDiscounts: IncludedDiscountLike[] } } }[];
  shippingInfo?: { discountedPrice?: { includedDiscounts: IncludedDiscountLike[] } };
  discountCodes?: {
    state: string;
    discountCode: { id: string; obj?: { code: string; name?: Record<string, string>; cartDiscounts: { id: string }[] } };
  }[];
}

const REASONS = ['DoesNotMatchCart', 'NotActive', 'NotValid', 'MaxApplicationReached', 'ApplicationStoppedByPreviousDiscount'] as const;

/**
 * Discount codes read back from the cart (K-05). `MatchesCart` is applied; every other state is `not_applicable` with its
 * own reason key (`checkout.promo.reasons.<state>`). Saving per code: the sum of the included discount amounts (times the
 * quantity of the entry) of the cart discounts that belong to the code, plus shipping discounts of the same discounts.
 */
export function codeSavings(cart: SavingsCart, locale: string): DiscountCodeView[] {
  return (cart.discountCodes ?? []).map((d) => {
    const ids = new Set((d.discountCode.obj?.cartDiscounts ?? []).map((c) => c.id));
    let saving = 0;
    for (const l of cart.lineItems) {
      for (const e of l.discountedPricePerQuantity ?? []) {
        for (const inc of e.discountedPrice.includedDiscounts) if (ids.has(inc.discount.id)) saving += inc.discountedAmount.centAmount * e.quantity;
      }
    }
    const shipping = cart.shipping?.map((s) => s.shippingInfo) ?? (cart.shippingInfo ? [cart.shippingInfo] : []);
    for (const s of shipping) for (const inc of s.discountedPrice?.includedDiscounts ?? []) if (ids.has(inc.discount.id)) saving += inc.discountedAmount.centAmount;
    const applied = d.state === 'MatchesCart';
    const name = d.discountCode.obj?.name;
    const label = name ? (name[locale] ?? Object.values(name)[0] ?? null) : null;
    return {
      code: d.discountCode.obj?.code ?? '',
      label,
      state: applied ? 'applied' : 'not_applicable',
      reason: applied ? null : ((REASONS as readonly string[]).includes(d.state) ? d.state : 'NotValid'),
      savingCents: applied ? saving : null,
    } satisfies DiscountCodeView;
  });
}
