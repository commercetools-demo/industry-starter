import { BRANDS, BRAND_SLUGS, type BrandSlug } from '@/lib/brands';
import type { Cart, CartGroup, CartLine, Money } from '@/lib/types';

/**
 * The cart is one cart for every brand; the UI shows its lines in one section per brand (multibrand design D5). A section keeps the
 * fulfilment clusters of the cart (`Cart.groups`), reduced to the brand's lines, so a collect or delivery cluster that holds lines of
 * two brands appears in both sections. Checkout, shipping and totals are untouched: one order, one shipment (the groups of the
 * cart stay the unit of payment).
 */
export interface BrandSection {
  brand: BrandSlug;
  /** Display name of the brand (the section heading). */
  name: string;
  groups: CartGroup[];
  lines: CartLine[];
  /** Display sum of the engine's line totals of this brand. */
  subtotal: Money;
}

/** Sections with at least one line, the current brand first, then the other brands in registry order. Empty sections do not exist. */
export function brandSections(cart: Pick<Cart, 'lines' | 'groups' | 'currency'>, current: BrandSlug): BrandSection[] {
  const order = [current, ...BRAND_SLUGS.filter((b) => b !== current)];
  return order.flatMap((brand) => {
    const lines = cart.lines.filter((l) => l.brand === brand);
    if (lines.length === 0) return [];
    const ids = new Set(lines.map((l) => l.id));
    const groups = cart.groups
      .map((g) => ({ ...g, lineIds: g.lineIds.filter((id) => ids.has(id)) }))
      .filter((g) => g.lineIds.length > 0);
    const currencyCode = lines[0]?.total.currencyCode ?? cart.currency;
    return [{ brand, name: BRANDS[brand].name, groups, lines, subtotal: { centAmount: lines.reduce((n, l) => n + l.total.centAmount, 0), currencyCode } }];
  });
}
