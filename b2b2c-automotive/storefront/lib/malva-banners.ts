// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Malva home banners (change add-malva-home, D8): the custom object `malva-site` / `home-banners` written by the seed, parsed
// and localised. Pure (no server-only import) so it is testable and safe anywhere. Bad entries are dropped, never thrown on.
import { getLocalizedString } from '@/lib/utils';

export const MALVA_BANNER_CONTAINER = 'malva-site';
export const MALVA_BANNER_KEY = 'home-banners';

export interface MalvaBannerView {
  headline: string;
  subline: string;
  /** Slug of the category the banner links to (`/{locale}/categories/{slug}`); absent when the banner has no valid link. */
  categorySlug?: string;
  /** Absent when the banner has no usable image: the carousel then shows the text on the theme background. */
  image?: { url: string; width: number; height: number };
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,127}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function localized(value: unknown, locale: string): string {
  if (!isRecord(value)) return '';
  const strings: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === 'string') strings[k] = v;
  return getLocalizedString(strings, locale).trim();
}

function parseImage(value: unknown): MalvaBannerView['image'] {
  if (!isRecord(value) || typeof value.url !== 'string') return undefined;
  try {
    if (new URL(value.url).protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  const dims = isRecord(value.dimensions) ? value.dimensions : {};
  const width = typeof dims.w === 'number' && dims.w > 0 ? dims.w : 1600;
  const height = typeof dims.h === 'number' && dims.h > 0 ? dims.h : 600;
  return { url: value.url, width, height };
}

/** The banners of the stored value in the shopper's locale. A banner without a headline is dropped. A null or malformed value gives `[]`. */
export function parseMalvaBanners(value: unknown, locale: string): MalvaBannerView[] {
  if (!isRecord(value) || !Array.isArray(value.banners)) return [];
  const out: MalvaBannerView[] = [];
  for (const raw of value.banners) {
    if (!isRecord(raw)) continue;
    const headline = localized(raw.headline, locale);
    if (!headline) continue;
    const slug = localized(raw.categorySlug, locale);
    out.push({ headline, subline: localized(raw.subline, locale), categorySlug: SLUG.test(slug) ? slug : undefined, image: parseImage(raw.image) });
  }
  return out;
}
