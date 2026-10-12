// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// commercetools cart (expanded, see `CART_EXPAND`) to the cart view model (workstream N-07). Prices are the cart's own standalone-price
// selection; there is no price floor or minimum price logic (D17). Currency, tax label and rate come from the cart, never from literals.
import type { Attribute, Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { collectSavings, mapPromoCodes } from '@/lib/mappers/cart-savings';
import { mapMoney } from '@/lib/mappers/money';
import { getFitState } from '@/lib/search/fitment';
import { splitStock, type LineStock } from '@/lib/store/stock';
import type { Cart, CartLine, DeliveryMode, DeliveryOption, Money } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export interface CartMapContext {
  locale: string;
  options: DeliveryOption[];
  /** Quantities by sku (`getLineStock`); a sku that is missing has no stock. */
  stock: Record<string, LineStock>;
  branchName: string | null;
  /** The active vehicle; without one every line is `unknown`. */
  vehicle: { make: string; model: string; year: number; engine: string } | null;
  /** Name of a discount that has none (message `cart.savingFallback`). */
  savingFallback: string;
  unpricedSkus: string[];
}

const attribute = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const brandOf = (attrs: Attribute[] | undefined): string | null => {
  const brand = attribute(attrs, 'brand');
  if (typeof brand === 'object' && brand !== null) {
    const { label, key } = brand as { label?: unknown; key?: unknown };
    return text(label) ?? text(key) ?? null;
  }
  return text(brand) ?? text(attribute(attrs, 'brand-name')) ?? null;
};

const SHIP_KEY_MODE: Record<string, DeliveryMode> = { 'mau-ship-pickup': 'pickup', 'mau-ship-standard': 'ship' };
const percent = (rate: number): string => `${Math.round(rate * 1000) / 10}`;

/**
 * "DE VAT 19%" becomes "VAT (19%)": the rate name without its country prefix, a repeated percentage or a "placeholder" note, then the
 * rate. An empty result (nothing left of the name) means the page uses its generic "Tax" label.
 */
export function taxLabel(name: string | undefined, rate: number): string {
  const cleaned = (name ?? '')
    .replace(/\s*\d+([.,]\d+)?\s*%/g, '')
    .replace(/^[A-Z]{2}\s+/, '')
    .replace(/\s*placeholder\b/i, '')
    .trim();
  if (!cleaned) return '';
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} (${percent(rate)}%)`;
}

function selectedMode(cart: CtCart): DeliveryMode | null {
  const method = cart.shippingInfo?.shippingMethod as { obj?: { key?: string } } | undefined;
  const key = method?.obj?.key;
  if (key && SHIP_KEY_MODE[key]) return SHIP_KEY_MODE[key];
  if (cart.custom?.fields?.pickupBranchKey) return 'pickup';
  return cart.shippingInfo ? 'ship' : null;
}

function mapLine(line: LineItem, ctx: CartMapContext): CartLine {
  const attrs = line.variant.attributes;
  const sku = line.variant.sku ?? '';
  const keys = attribute(attrs, 'fitment-keys');
  const fitment = { fitmentKeys: Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [], universalFit: attribute(attrs, 'universal-fit') === true };
  const split = splitStock(line.quantity, ctx.stock[sku] ?? { branchQty: 0, masterQty: 0 });
  const discounted = line.price.discounted?.value;
  const info = line.recurrenceInfo;
  const policy = info?.recurrencePolicy as { id: string; obj?: { key?: string; name?: Record<string, string> } } | undefined;
  return {
    id: line.id,
    sku,
    productSlug: getLocalizedString(line.productSlug, ctx.locale),
    brand: brandOf(attrs),
    name: getLocalizedString(line.name, ctx.locale),
    imageUrl: line.variant.images?.[0]?.url ?? null,
    quantity: line.quantity,
    unitPrice: mapMoney(discounted ?? line.price.value),
    listUnitPrice: discounted ? mapMoney(line.price.value) : null,
    total: mapMoney(line.totalPrice),
    stock: { ...split, available: split.fromStore + split.shipsLater, branchName: ctx.branchName },
    fit: getFitState(fitment, ctx.vehicle),
    fitment,
    recurrence: info
      ? { policyKey: policy?.obj?.key ?? policy?.id ?? '', policyName: getLocalizedString(policy?.obj?.name, ctx.locale) || policy?.obj?.key || '', priceMode: info.priceSelectionMode === 'Fixed' ? 'Fixed' : 'Dynamic' }
      : null,
  };
}

function mapTax(cart: CtCart): Cart['totals']['tax'] {
  const taxed = cart.taxedPrice;
  if (!taxed) return null;
  const portions = taxed.taxPortions ?? [];
  const rates = new Set(portions.map((p) => p.rate));
  const amount = taxed.totalTax ? mapMoney(taxed.totalTax) : ({ ...mapMoney(taxed.totalGross), centAmount: taxed.totalGross.centAmount - taxed.totalNet.centAmount } satisfies Money);
  if (rates.size !== 1) return { label: '', rate: null, amount };
  const [rate] = [...rates];
  const name = portions[0]?.name ?? cart.lineItems?.[0]?.taxRate?.name;
  return { label: taxLabel(name, rate), rate, amount };
}

export function mapCart(ct: CtCart, ctx: CartMapContext): Cart {
  const lines = (ct.lineItems ?? []).map((line) => mapLine(line, ctx));
  const currency = ct.totalPrice.currencyCode;
  const digits = ct.totalPrice.fractionDigits;
  const money = (centAmount: number): Money => ({ centAmount, currencyCode: currency, fractionDigits: digits });
  const subtotal = (ct.lineItems ?? []).reduce((sum, line) => sum + line.price.value.centAmount * line.quantity, 0);
  return {
    id: ct.id,
    version: ct.version,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    delivery: { selected: selectedMode(ct), options: ctx.options },
    promoCodes: mapPromoCodes(ct),
    totals: {
      subtotal: money(subtotal),
      savings: collectSavings(ct, ctx.locale, ctx.savingFallback),
      delivery: ct.shippingInfo ? mapMoney(ct.shippingInfo.price) : money(0),
      tax: mapTax(ct),
      total: mapMoney(ct.taxedPrice?.totalGross ?? ct.totalPrice),
      pricesIncludeTax: ct.lineItems?.[0]?.taxRate?.includedInPrice ?? false,
    },
    hasSubscription: lines.some((line) => line.recurrence !== null),
    unpricedSkus: ctx.unpricedSkus,
  };
}
