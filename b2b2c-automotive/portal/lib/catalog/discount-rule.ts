/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Structured discount rules (T-01, decisions 13, 15, 16): compile to commercetools drafts, describe in plain language,
// preview on a sample cart and validate. Pure. Predicates are built from validated fields only: ids, SKUs and the store
// key are checked against SAFE_ID, free text is never concatenated into a predicate.
export type ProductScope = { kind: 'all' } | { kind: 'category'; categoryId: string; label: string } | { kind: 'skus'; skus: string[] };
export type CartCondition = { kind: 'always' } | { kind: 'cartTotalAtLeast'; centAmount: number } | { kind: 'category'; categoryId: string };
export type Effect = { kind: 'relative'; percent: number } | { kind: 'absolute'; centAmount: number } | { kind: 'freeShipping' };

export interface ProductRule {
  name: Record<string, string>;
  scope: ProductScope;
  effect: Exclude<Effect, { kind: 'freeShipping' }>;
  validFrom?: string;
  validUntil?: string;
}

export interface CartRule {
  name: Record<string, string>;
  condition: CartCondition;
  effect: Effect;
  stacking: 'Stacking' | 'StopAfterThisDiscount';
  code?: string;
  validFrom?: string;
  validUntil?: string;
}

export const SAFE_ID = /^[A-Za-z0-9_-]+$/;
export const CODE_PATTERN = /^[A-Za-z0-9_-]{3,50}$/;
/** Key of the custom type every cart discount of the portal carries (seed/src/data/discounts.ts). */
export const CART_DISCOUNT_TYPE_KEY = 'mau-cart-discount-fields';

export interface CompileOptions {
  key?: string;
  sortOrder?: string;
  /** Currencies an absolute amount applies to (default EUR). */
  currencies?: string[];
  /** Currency of a cart total condition (default EUR). */
  currency?: string;
}

function safe(value: string, what: string): string {
  if (!SAFE_ID.test(value)) throw new Error(`Unsafe ${what} in predicate`);
  return value;
}

export const centsToDecimal = (cents: number): string => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

function relativeValue(percent: number) {
  return { type: 'relative' as const, permyriad: Math.round(percent * 100) };
}
function absoluteValue(centAmount: number, currencies: string[]) {
  return { type: 'absolute' as const, money: currencies.map((currencyCode) => ({ currencyCode, centAmount })) };
}

function schedule(rule: { validFrom?: string; validUntil?: string }) {
  return { ...(rule.validFrom ? { validFrom: rule.validFrom } : {}), ...(rule.validUntil ? { validUntil: rule.validUntil } : {}) };
}

/** The store channel clause appended to every product discount predicate (an edit can never drop it). */
export function withChannelClause(predicate: string, channelId: string): string {
  return `${predicate} and channel.id = "${safe(channelId, 'channel id')}"`;
}

export function productPredicate(scope: ProductScope): string {
  if (scope.kind === 'category') return `categories.id contains any ("${safe(scope.categoryId, 'category id')}")`;
  if (scope.kind === 'skus') return `sku in (${scope.skus.map((sku) => `"${safe(sku, 'SKU')}"`).join(', ')})`;
  return 'true';
}

export function compileProductDiscount(rule: ProductRule, channelId: string, options: CompileOptions = {}) {
  const base = productPredicate(rule.scope);
  return {
    ...(options.key ? { key: options.key } : {}),
    name: rule.name,
    value: rule.effect.kind === 'relative' ? relativeValue(rule.effect.percent) : absoluteValue(rule.effect.centAmount, options.currencies ?? ['EUR']),
    predicate: withChannelClause(base, channelId),
    ...(options.sortOrder ? { sortOrder: options.sortOrder } : {}),
    isActive: false,
    ...schedule(rule),
  };
}

export function cartPredicate(condition: CartCondition, currency = 'EUR'): string {
  if (condition.kind === 'cartTotalAtLeast') return `totalPrice >= "${centsToDecimal(condition.centAmount)} ${currency}"`;
  if (condition.kind === 'category') return `lineItemExists(categories.id contains any ("${safe(condition.categoryId, 'category id')}"))`;
  return 'true';
}

export function compileCartDiscount(rule: CartRule, storeKey: string, options: CompileOptions = {}) {
  const currencies = options.currencies ?? ['EUR'];
  const target =
    rule.effect.kind === 'freeShipping'
      ? { type: 'shipping' as const }
      : rule.condition.kind === 'category' && rule.effect.kind === 'relative'
        ? { type: 'lineItems' as const, predicate: `categories.id contains any ("${safe(rule.condition.categoryId, 'category id')}")` }
        : { type: 'totalPrice' as const };
  const value =
    rule.effect.kind === 'freeShipping' ? relativeValue(100) : rule.effect.kind === 'relative' ? relativeValue(rule.effect.percent) : absoluteValue(rule.effect.centAmount, currencies);
  return {
    ...(options.key ? { key: options.key } : {}),
    name: rule.name,
    value,
    target,
    cartPredicate: cartPredicate(rule.condition, options.currency ?? 'EUR'),
    stores: [{ typeId: 'store' as const, key: safe(storeKey, 'store key') }],
    custom: { type: { typeId: 'type' as const, key: CART_DISCOUNT_TYPE_KEY }, fields: { fundedBy: 'reseller', storeKey } },
    stackingMode: rule.stacking,
    requiresDiscountCode: Boolean(rule.code),
    ...(options.sortOrder ? { sortOrder: options.sortOrder } : {}),
    isActive: false,
    ...schedule(rule),
  };
}

// ---- plain language ----

type Locale = 'de-DE' | 'en-US';

const money = (cents: number, currency: string, locale: Locale, whole = false): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, ...(whole && cents % 100 === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) }).format(cents / 100);

const percentText = (percent: number, locale: Locale): string => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(percent / 100).replace(/ /g, ' ');

/** Effect strings of the lists: "−8%", "−€2.00 / unit", "Shipping €0". */
export function describeEffect(effect: Effect, locale: Locale = 'en-US', currency = 'EUR', where: 'product' | 'cart' = 'cart'): string {
  if (effect.kind === 'freeShipping') return locale === 'de-DE' ? `Versand ${money(0, currency, locale, true)}` : `Shipping ${money(0, currency, locale, true)}`;
  if (effect.kind === 'relative') return `−${percentText(effect.percent, locale)}`;
  const unit = where === 'product' ? (locale === 'de-DE' ? ' / Stück' : ' / unit') : '';
  return `−${money(effect.centAmount, currency, locale)}${unit}`;
}

export function describeScope(scope: ProductScope | CartCondition, locale: Locale = 'en-US', currency = 'EUR'): string {
  if (scope.kind === 'category') return `${locale === 'de-DE' ? 'Kategorie' : 'Category'} · ${'label' in scope ? scope.label : scope.categoryId}`;
  if (scope.kind === 'skus') return scope.skus.join(', ');
  if (scope.kind === 'cartTotalAtLeast') return `${locale === 'de-DE' ? 'Warenkorb' : 'Cart total'} ≥ ${money(scope.centAmount, currency, locale, true)}`;
  return locale === 'de-DE' ? 'Alle Produkte' : 'All products';
}

/** One plain-language sentence, for example "−3% on carts of €2,000 or more". */
export function describeRule(rule: ProductRule | CartRule, locale: Locale = 'en-US', currency = 'EUR'): string {
  const de = locale === 'de-DE';
  if ('condition' in rule) {
    const effect = describeEffect(rule.effect, locale, currency);
    const c = rule.condition;
    if (rule.effect.kind === 'freeShipping') {
      if (c.kind === 'cartTotalAtLeast') return de ? `${effect} bei Warenkörben ab ${money(c.centAmount, currency, locale, true)}` : `${effect} on carts of ${money(c.centAmount, currency, locale, true)} or more`;
      return de ? `${effect} für alle Warenkörbe` : `${effect} on every cart`;
    }
    if (c.kind === 'cartTotalAtLeast') return de ? `${effect} auf Warenkörbe ab ${money(c.centAmount, currency, locale, true)}` : `${effect} on carts of ${money(c.centAmount, currency, locale, true)} or more`;
    if (c.kind === 'category') return de ? `${effect} auf Teile der gewählten Kategorie im Warenkorb` : `${effect} on parts of the chosen category in the cart`;
    return de ? `${effect} auf jeden Warenkorb` : `${effect} on every cart`;
  }
  const effect = describeEffect(rule.effect, locale, currency, 'product');
  if (rule.scope.kind === 'category') return de ? `${effect} auf ${describeScope(rule.scope, locale)}` : `${effect} on ${describeScope(rule.scope, locale)}`;
  if (rule.scope.kind === 'skus') return de ? `${effect} auf ${rule.scope.skus.join(', ')}` : `${effect} on ${rule.scope.skus.join(', ')}`;
  return de ? `${effect} auf alle Produkte` : `${effect} on all products`;
}

// ---- preview ----

export interface SampleLine {
  sku: string;
  categoryId?: string;
  unitCents: number;
  quantity: number;
}
export interface SampleCart {
  lines: SampleLine[];
  shippingCents?: number;
}
export interface Preview {
  applies: boolean;
  /** Named savings, each a negative amount in cents. */
  lines: { label: string; cents: number }[];
  savingsCents: number;
  totalBefore: number;
  totalAfter: number;
}

const lineTotal = (l: SampleLine) => l.unitCents * l.quantity;
const cartTotal = (cart: SampleCart) => cart.lines.reduce((sum, l) => sum + lineTotal(l), 0);

function effectCents(effect: Effect, base: number, units = 1): number {
  if (effect.kind === 'relative') return Math.round((base * Math.round(effect.percent * 100)) / 10000);
  if (effect.kind === 'absolute') return Math.min(base, effect.centAmount * units);
  return 0;
}

/** Local evaluation of the structured rule on a sample cart (an acceptance script proves it matches commercetools). */
export function previewRule(rule: ProductRule | CartRule, cart: SampleCart): Preview {
  const label = Object.values(rule.name).find(Boolean) ?? '';
  const totalBefore = cartTotal(cart) + (cart.shippingCents ?? 0);
  const none: Preview = { applies: false, lines: [], savingsCents: 0, totalBefore, totalAfter: totalBefore };
  let saving = 0;

  if ('condition' in rule) {
    const c = rule.condition;
    const subtotal = cartTotal(cart);
    if (c.kind === 'cartTotalAtLeast' && subtotal < c.centAmount) return none;
    if (c.kind === 'category' && !cart.lines.some((l) => l.categoryId === c.categoryId)) return none;
    if (rule.effect.kind === 'freeShipping') saving = cart.shippingCents ?? 0;
    else if (c.kind === 'category' && rule.effect.kind === 'relative') saving = effectCents(rule.effect, cart.lines.filter((l) => l.categoryId === c.categoryId).reduce((s, l) => s + lineTotal(l), 0));
    else saving = effectCents(rule.effect, subtotal);
  } else {
    const matching = cart.lines.filter((l) => (rule.scope.kind === 'all' ? true : rule.scope.kind === 'category' ? l.categoryId === rule.scope.categoryId : rule.scope.skus.includes(l.sku)));
    if (matching.length === 0) return none;
    saving = matching.reduce((sum, l) => sum + (rule.effect.kind === 'relative' ? effectCents(rule.effect, lineTotal(l)) : Math.min(lineTotal(l), rule.effect.centAmount * l.quantity)), 0);
  }
  if (saving <= 0) return none;
  return { applies: true, lines: [{ label, cents: -saving }], savingsCents: saving, totalBefore, totalAfter: totalBefore - saving };
}

// ---- validation (decision 16) ----

export interface RuleIssue {
  field: 'name' | 'effect' | 'scope' | 'condition' | 'validFrom' | 'validUntil' | 'code';
  message: string;
}

/** What the caller knows about the prices a rule would hit (workstream X, Q-X08). */
export interface RuleContext {
  /** Lowest unit price in the scope of a product rule, in cents; unknown when omitted. */
  lowestUnitCents?: number;
}

/**
 * Empty list = valid. Relative percent 0.01 to 99.99 (a result price is always above zero, so 100 percent is refused), absolute amount above
 * zero and below the price it applies to (a cart rule needs a cart total condition larger than the amount; a product rule is checked against
 * `ctx.lowestUnitCents`), `validFrom < validUntil`. There is no floor and no cost check.
 */
export function validateRule(rule: ProductRule | CartRule, ctx: RuleContext = {}): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!Object.values(rule.name).some((v) => v.trim())) issues.push({ field: 'name', message: 'Enter a name' });
  const effect = rule.effect;
  if (effect.kind === 'relative' && !(effect.percent >= 0.01 && Math.round(effect.percent * 100) <= 9999)) issues.push({ field: 'effect', message: 'The percentage must be between 0.01 and 99.99' });
  if (effect.kind === 'absolute' && !(Number.isInteger(effect.centAmount) && effect.centAmount > 0)) issues.push({ field: 'effect', message: 'The amount must be above zero' });
  else if (effect.kind === 'absolute') {
    if ('condition' in rule) {
      const c = rule.condition;
      if (c.kind !== 'cartTotalAtLeast') issues.push({ field: 'effect', message: 'A fixed amount needs a minimum cart total above the amount' });
      else if (effect.centAmount >= c.centAmount) issues.push({ field: 'effect', message: 'The amount must be below the minimum cart total' });
    } else if (ctx.lowestUnitCents !== undefined && effect.centAmount >= ctx.lowestUnitCents) {
      issues.push({ field: 'effect', message: 'The amount must be below the price of every part it applies to' });
    }
  }
  if ('condition' in rule) {
    const c = rule.condition;
    if (c.kind === 'cartTotalAtLeast' && !(Number.isInteger(c.centAmount) && c.centAmount > 0)) issues.push({ field: 'condition', message: 'The cart total must be above zero' });
    if (c.kind === 'category' && !SAFE_ID.test(c.categoryId)) issues.push({ field: 'condition', message: 'Choose a category' });
    if (rule.code !== undefined && rule.code !== '' && !CODE_PATTERN.test(rule.code)) issues.push({ field: 'code', message: 'Use 3 to 50 letters, digits, dashes or underscores' });
  } else {
    const s = rule.scope;
    if (s.kind === 'category' && !SAFE_ID.test(s.categoryId)) issues.push({ field: 'scope', message: 'Choose a category' });
    if (s.kind === 'skus' && (s.skus.length === 0 || s.skus.some((sku) => !SAFE_ID.test(sku)))) issues.push({ field: 'scope', message: 'Enter at least one valid part number' });
  }
  const from = rule.validFrom ? Date.parse(rule.validFrom) : undefined;
  const until = rule.validUntil ? Date.parse(rule.validUntil) : undefined;
  if (rule.validFrom && Number.isNaN(from)) issues.push({ field: 'validFrom', message: 'Enter a valid start date' });
  if (rule.validUntil && Number.isNaN(until)) issues.push({ field: 'validUntil', message: 'Enter a valid end date' });
  if (from !== undefined && until !== undefined && !Number.isNaN(from) && !Number.isNaN(until) && from >= until) issues.push({ field: 'validUntil', message: 'The end must be after the start' });
  return issues;
}
