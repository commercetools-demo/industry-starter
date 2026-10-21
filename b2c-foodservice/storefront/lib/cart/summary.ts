import type { Cart, CartBlocker, CartLine, Money, ProductShape, VariantAttrValue } from '@/lib/types';

/** Translator bound to the `cart` namespace (a server `getTranslations` or a client `useTranslations`). */
export type VariantTranslator = (
  key: 'variant.intensity' | 'variant.capsules' | 'variant.grams',
  values: Record<string, string | number>,
) => string;

/**
 * One-line variant description for a cart line: "Intensity 8 · 10 capsules" (pods), "250 g · Whole bean" (coffee),
 * "Black · Machine only" (machine), "Cream" (accessory). `attrs` holds the product and variant attributes as enum keys,
 * numbers or text; `labels` the display label of each enum attribute. Pure.
 */
export function variantSummary(
  shape: ProductShape,
  attrs: Record<string, VariantAttrValue>,
  labels: Record<string, string>,
  t: VariantTranslator,
): string {
  const label = (name: string): string | undefined => {
    const v = attrs[name];
    if (v === undefined) return undefined;
    return labels[name] ?? String(v);
  };
  const num = (name: string): number | undefined => {
    const v = attrs[name];
    return typeof v === 'number' ? v : undefined;
  };
  const parts: (string | undefined)[] = [];
  if (shape === 'pods') {
    const intensity = num('intensity');
    const count = num('capsulesPerPack');
    parts.push(
      intensity !== undefined ? t('variant.intensity', { n: intensity }) : undefined,
      count !== undefined ? t('variant.capsules', { count }) : undefined,
    );
  } else if (shape === 'coffee') {
    const grams = num('sizeGrams');
    parts.push(grams !== undefined ? t('variant.grams', { n: grams }) : undefined, label('grind'));
  } else if (shape === 'machine') {
    parts.push(label('colour'), label('bundle'));
  } else if (shape === 'accessory') {
    parts.push(label('colour'));
  }
  return parts.filter((p): p is string => Boolean(p)).join(' · ');
}

/** How the tax row reads: 'included' ("Includes {tax} tax"), 'estimated' ("Estimated tax"), 'later' (no tax figure from the engine). */
export function taxLabel(tax: Cart['tax']): 'included' | 'estimated' | 'later' {
  if (!tax) return 'later';
  return tax.included ? 'included' : 'estimated';
}

/**
 * Free-shipping progress (Q-I-03): only lines that ship (delivery, subscribe) count, because collection lines do not ship.
 * Display figures only, summed from the engine's line totals. No threshold or no shippable line: `remaining` is null and
 * `reached` false (the block is hidden). The threshold itself comes from commercetools (`getFreeShippingThreshold`).
 */
export function freeShipping(
  threshold: Money | null,
  lines: ReadonlyArray<Pick<CartLine, 'fulfilment' | 'total'>>,
): Cart['freeShipping'] {
  const shippable = lines.filter((l) => l.fulfilment !== 'collect');
  if (!threshold || threshold.centAmount <= 0 || shippable.length === 0) return { threshold, remaining: null, reached: false };
  const sum = shippable.reduce((n, l) => n + l.total.centAmount, 0);
  if (sum >= threshold.centAmount) return { threshold, remaining: null, reached: true };
  return { threshold, remaining: { centAmount: threshold.centAmount - sum, currencyCode: threshold.currencyCode }, reached: false };
}

/**
 * Minimum order value (Q-I-02). commercetools does not enforce one, so the rule lives here and in K's checkout guard
 * through this same function. `min` 0 or missing means off.
 */
export function minimumOrder(subtotal: Money, min: number | undefined): Cart['minimumOrder'] {
  if (!min || min <= 0) return { value: null, shortfall: null };
  const value = { centAmount: min, currencyCode: subtotal.currencyCode };
  const shortfall = subtotal.centAmount < min ? { centAmount: min - subtotal.centAmount, currencyCode: subtotal.currencyCode } : null;
  return { value, shortfall };
}

/**
 * What stops checkout (Q-I-09): an empty bag, a bag below the minimum, a line that is out of stock (online, or more than
 * the stock) or not in stock at its store, a line without a price. Price changes never block.
 */
export function blockers(lines: ReadonlyArray<Pick<CartLine, 'notices' | 'unitPrice'>>, belowMinimum: boolean): CartBlocker[] {
  const out: CartBlocker[] = [];
  if (lines.length === 0) out.push('empty');
  if (belowMinimum) out.push('below-minimum');
  const has = (kinds: string[]) => lines.some((l) => l.notices.some((n) => kinds.includes(n.kind)));
  if (has(['out-of-stock', 'quantity-exceeds-stock'])) out.push('out-of-stock');
  if (has(['collect-unavailable'])) out.push('collect-unavailable');
  if (lines.some((l) => l.unitPrice.centAmount <= 0)) out.push('price-unavailable');
  return out;
}
