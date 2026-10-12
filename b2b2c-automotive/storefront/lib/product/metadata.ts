// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Metadata of the product page (workstream M). Pure: the origin is passed in.
import type { Metadata } from 'next';
import type { ProductDetail } from '@/lib/types';

export const DESCRIPTION_MAX = 155;

/** First 155 characters of the plain description, on a word boundary when one exists; empty without a description. */
export function metaDescription(description: string | null): string {
  const plain = (description ?? '').replace(/\s+/g, ' ').trim();
  if (plain.length <= DESCRIPTION_MAX) return plain;
  const cut = plain.slice(0, DESCRIPTION_MAX);
  const space = cut.lastIndexOf(' ');
  return (space > DESCRIPTION_MAX - 30 ? cut.slice(0, space) : cut).trimEnd();
}

/**
 * Title "{name} ({partNumber})" (the store layout's template appends " | {reseller}"), description, canonical address and the
 * first image for Open Graph. `origin` is the request origin (null: a relative canonical).
 */
export function buildProductMetadata(product: ProductDetail, fallbackDescription: string, location: { origin: string | null; locale: string; store: string }): Metadata {
  const path = `/${location.locale}/${location.store}/p/${product.slug}`;
  const canonical = location.origin ? `${location.origin}${path}` : path;
  const description = metaDescription(product.description) || fallbackDescription;
  const image = product.images[0]?.url;
  return {
    title: `${product.name} (${product.partNumber})`,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title: product.name, description, url: canonical, ...(image ? { images: [{ url: image }] } : {}) },
  };
}
