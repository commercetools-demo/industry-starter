// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Maps products and stores to the Malva level models (change add-malva-home). Neither model has a price, stock or id field.
import type { Attribute, ProductProjection, Store } from '@commercetools/platform-sdk';
import { mapShellContext } from '@/lib/mappers/shell';
import type { MalvaProductSummary, Reseller } from '@/lib/malva-types';
import { getLocalizedString } from '@/lib/utils';

const attribute = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const enumLabel = (v: unknown): string | undefined => {
  if (typeof v !== 'object' || v === null) return undefined;
  const { label, key } = v as { label?: unknown; key?: unknown };
  return text(label) ?? text(key);
};
const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** The card model of the Malva listing: identity, text, image, brand and fit data. Price and availability are never read. */
export function mapMalvaSummary(projection: ProductProjection, locale: string): MalvaProductSummary {
  const master = projection.masterVariant;
  const attrs = master.attributes;
  const name = getLocalizedString(projection.name, locale);
  const image = master.images?.[0];
  const fitment = attribute(attrs, 'fitment-keys');
  const sku = master.sku ?? '';
  return {
    id: projection.id,
    sku,
    partNumber: text(attribute(attrs, 'part-number')) ?? sku,
    name,
    slug: getLocalizedString(projection.slug, locale),
    brand: enumLabel(attribute(attrs, 'brand')) ?? text(attribute(attrs, 'brand-name')) ?? '',
    imageUrl: image?.url,
    imageAlt: text(image?.label) ?? name,
    universalFit: attribute(attrs, 'universal-fit') === true,
    fitmentKeys: Array.isArray(fitment) ? fitment.filter((k): k is string => typeof k === 'string') : [],
  };
}

/**
 * A store read with `distributionChannels[*]` expanded, as the finder shows it. `null` when the store has no distribution channel
 * (it has no catalogue to shop). The address and coordinates are the `store-settings` fields; branches are the `branch-info` channels.
 */
export function mapReseller(store: Store, locale: string): Reseller | null {
  if (!store.distributionChannels?.length) return null;
  const f = store.custom?.fields as Record<string, unknown> | undefined;
  const shell = mapShellContext(store, locale);
  return {
    key: store.key,
    name: shell.settings.name,
    city: text(f?.city) ?? '',
    postalCode: text(f?.postalCode) ?? '',
    address: text(f?.addressLine) ?? '',
    lat: finite(f?.latitude),
    lng: finite(f?.longitude),
    branches: shell.branches.map((b) => ({ key: b.key, name: b.name, city: b.address.city, lat: b.geo?.lat, lng: b.geo?.lng })),
  };
}
