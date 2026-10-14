/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Types of the Malva catalog manifests (workstream G). X (coordinated release) imports OfferManifest, CartDiscountManifest,
// PriceSpec and LocalizedString from here.
import type {
  CartDiscountDraft,
  CategoryDraft,
  InventoryDraft,
  LocalizedString,
  PriceDraft,
  ProductDraft,
  ProductTypeDraft,
  VariantDraft,
} from '../types';

export type { LocalizedString };

export type Currency = 'USD' | 'EUR';
export type Locale = 'en-US' | 'de-DE';
export const LOCALES: Locale[] = ['en-US', 'de-DE'];

/** Market of each currency (D-004). */
export const COUNTRY_OF: Record<Currency, string> = { USD: 'US', EUR: 'DE' };

/** One price of a variant: amount in the currency's minor unit, country, recurrence policy key (absent = one-time). */
export interface PriceSpec {
  currency: Currency;
  centAmount: number;
  country: string;
  recurrencePolicy?: string;
  /** Customer group key: the price applies only to buyers in this group. */
  customerGroup?: string;
  /** Channel key: the price applies only in this sales channel. */
  channel?: string;
  validFrom?: string;
  validUntil?: string;
}

export type VariantManifest = VariantDraft;
export type ProductManifest = ProductDraft;
/** An offer is a product of type `malva-offer`. */
export type OfferManifest = ProductDraft;
export type CartDiscountManifest = CartDiscountDraft;
export type CategoryManifest = CategoryDraft;
export type InventoryManifest = InventoryDraft;
export type PriceManifest = PriceDraft;
export type ProductTypeManifest = ProductTypeDraft;

export function ls(enUS: string, deDE: string): LocalizedString {
  return { 'en-US': enUS, 'de-DE': deDE };
}

export const POLICY_MONTHLY = 'malva-monthly';

/** `<sku-lower>_<currency-lower>_<policy key or once>` (the platform allows only alphanumerics, underscores and hyphens in keys). */
export function priceKey(sku: string, currency: Currency, policy: string | undefined, scope: { customerGroup?: string; channel?: string } = {}): string {
  const scoped = [scope.customerGroup && `grp-${scope.customerGroup}`, scope.channel && `chn-${scope.channel}`].filter(Boolean).join('_');
  return `${sku.toLowerCase()}_${currency.toLowerCase()}_${policy ?? 'once'}${scoped ? `_${scoped}` : ''}`;
}

export function toPriceDraft(sku: string, spec: PriceSpec): PriceDraft {
  return {
    key: priceKey(sku, spec.currency, spec.recurrencePolicy, spec),
    value: { currencyCode: spec.currency, centAmount: spec.centAmount },
    country: spec.country,
    ...(spec.customerGroup ? { customerGroup: spec.customerGroup } : {}),
    ...(spec.channel ? { channel: spec.channel } : {}),
    ...(spec.recurrencePolicy ? { recurrencePolicy: spec.recurrencePolicy } : {}),
    ...(spec.validFrom ? { validFrom: spec.validFrom } : {}),
    ...(spec.validUntil ? { validUntil: spec.validUntil } : {}),
  };
}

export type AttributeValues = Record<string, unknown>;

/** Attribute name/value pairs of a manifest variant, in the given order, skipping undefined values. */
export function attrs(values: AttributeValues): { name: string; value: unknown }[] {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ({ name, value }));
}
