/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Which discounts belong to a store, and which are funded by Malva (decision 13). Product discounts have no custom fields and no
// stores, so a store's own product discounts are recognised by the channel clause in their predicate (those T creates) or by
// key (`<storeKey>-...` T-created, `mau-pd-<north|south>-...` seeded). Cart discounts carry `stores` and the custom type
// `mau-cart-discount-fields`. Malva-funded: product key `mau-pd-malva-*`; cart custom field `fundedBy = malva`.
import 'server-only';
import type { CartDiscount, ProductDiscount } from '@commercetools/platform-sdk';

export const MALVA_PRODUCT_PREFIX = 'mau-pd-malva-';

export interface StoreScope {
  storeKey: string;
  /** Ids of the store's distribution channels (retail channel and branches). */
  channelIds: string[];
}

const shortName = (storeKey: string) => storeKey.replace(/^mau-reseller-/, '');

export const isMalvaFundedProduct = (d: Pick<ProductDiscount, 'key'>): boolean => (d.key ?? '').startsWith(MALVA_PRODUCT_PREFIX);

export const isMalvaFundedCart = (d: Pick<CartDiscount, 'custom'>): boolean => d.custom?.fields?.fundedBy === 'malva';

/** W: a Malva-funded cart discount that names stores (a co-op discount) is visible only to those stores; one without stores is global. */
export const malvaCartVisibleTo = (d: Pick<CartDiscount, 'stores'>, storeKey: string): boolean => !d.stores?.length || d.stores.some((s) => s.key === storeKey);

/** W: the store's own co-op discount. Its content stays Malva-funded and locked, but the reseller may switch it on and off. */
export const isOwnCoopDiscount = (d: Pick<CartDiscount, 'key' | 'stores' | 'custom'>, storeKey: string): boolean =>
  (d.key ?? '').startsWith('coop-') && d.custom?.fields?.fundedBy === 'malva' && d.custom?.fields?.storeKey === storeKey && (d.stores ?? []).some((s) => s.key === storeKey);

export function belongsToStoreProduct(d: Pick<ProductDiscount, 'key' | 'predicate'>, scope: StoreScope): boolean {
  const key = d.key ?? '';
  if (key.startsWith(`${scope.storeKey}-`) || key.startsWith(`mau-pd-${shortName(scope.storeKey)}-`)) return true;
  return scope.channelIds.some((id) => d.predicate.includes(`channel.id = "${id}"`));
}

export function belongsToStoreCart(d: Pick<CartDiscount, 'stores' | 'custom'>, scope: StoreScope): boolean {
  return (d.stores ?? []).some((s) => s.key === scope.storeKey) || d.custom?.fields?.storeKey === scope.storeKey;
}

/** A discount created by "New ... discount" whose rule has not been completed in the editor. */
export const isDraftKey = (key: string | undefined): boolean => (key ?? '').endsWith('-draft');
