// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Attributed share links (workstream U-05, decision 9, Q-U05): `?ch=<channel>` on a storefront link; the storefront stores it
// and writes the order custom field `salesChannel`. Pure.

/** Channels with a share link. The seed enum `salesChannel` also has `in-store`, which has no share link. */
export const CHANNEL_IDS = ['web', 'instagram', 'facebook', 'whatsapp', 'tiktok'] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

/** Every value of the order field `salesChannel` (seed type `malva-checkout`). */
export const SALES_CHANNELS = [...CHANNEL_IDS, 'in-store'] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** Slug of the published page that backs the link-in-bio entry (create it in Content). */
export const LINK_IN_BIO_SLUG = '/link-in-bio';

export function shareLink(origin: string, locale: string, storeKey: string, channel: ChannelId): string {
  return `${origin}/${locale}/${storeKey}?ch=${channel}`;
}

/** The link-in-bio page of the store (storefront route `/links`, K's page by slug `/link-in-bio`). */
export function linkInBioLink(origin: string, locale: string, storeKey: string, channel: ChannelId): string {
  return `${origin}/${locale}/${storeKey}/links?ch=${channel}`;
}

/** Allow-list parse of a `ch` value; anything else is null. */
export function parseChannelParam(value: unknown): ChannelId | null {
  return typeof value === 'string' && (CHANNEL_IDS as readonly string[]).includes(value) ? (value as ChannelId) : null;
}

/** The sales channel of an order's custom field; unknown or absent values are null. */
export function parseSalesChannel(value: unknown): SalesChannel | null {
  return typeof value === 'string' && (SALES_CHANNELS as readonly string[]).includes(value) ? (value as SalesChannel) : null;
}
