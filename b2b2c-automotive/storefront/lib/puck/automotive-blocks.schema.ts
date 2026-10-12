// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// HAND-OFF TO WORKSTREAM U (portal): this file is framework free (zod only, no React, no Puck runtime). Copy it, and the field
// definitions of `components/contentools/automotive-puck-config.ts`, into `portal/` so the Contentools PageManager editor
// registers the same six blocks with the same props. The two apps share no workspace, so the copy is deliberate (Q-K01).
//
// The six blocks of the Malva automotive home page and their props. `parseBlockProps` never throws: a missing or invalid
// value falls back to the default (a Contentools document is author input and may be old or hand edited).
import { z } from 'zod';

export const AUTOMOTIVE_BLOCKS = ['AutomotiveHero', 'VehicleFinder', 'CategoryTiles', 'PopularProducts', 'PromoBanner', 'BrandStrip'] as const;
export type AutomotiveBlockName = (typeof AUTOMOTIVE_BLOCKS)[number];

export const PROMO_TONES = ['brand', 'accent', 'neutral'] as const;
export type PromoTone = (typeof PROMO_TONES)[number];
export const POPULAR_MIN = 4;
export const POPULAR_MAX = 8;

export interface AutomotiveHeroProps {
  eyebrow: string;
  headline: string;
  /** May contain `{city}` and `{pickup}` (today or tomorrow); empty means the automatic pickup promise of the store. */
  supportingLine: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
  showFinder: boolean;
}
export interface VehicleFinderProps {
  title: string;
}
export interface CategoryTilesProps {
  title: string;
  viewAllLabel?: string;
}
export interface PopularProductsProps {
  title: string;
  /** 4 to 8. */
  count: number;
  viewAllLabel: string;
}
export interface PromoBannerProps {
  title: string;
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
  tone: PromoTone;
}
export interface BrandStripProps {
  title?: string;
  brands: Array<{ name: string; logoUrl?: string; href?: string }>;
}

export interface AutomotiveBlockProps {
  AutomotiveHero: AutomotiveHeroProps;
  VehicleFinder: VehicleFinderProps;
  CategoryTiles: CategoryTilesProps;
  PopularProducts: PopularProductsProps;
  PromoBanner: PromoBannerProps;
  BrandStrip: BrandStripProps;
}

/** English defaults (also the editor's default props). The storefront overrides the texts with its message catalogs. */
export const DEFAULTS: AutomotiveBlockProps = {
  AutomotiveHero: {
    eyebrow: 'OEM parts · Fit guaranteed',
    headline: 'Genuine parts from {reseller}, ready near you.',
    supportingLine: '',
    ctaLabel: 'Shop all parts',
    ctaHref: '/parts',
    showFinder: true,
  },
  VehicleFinder: { title: 'Find parts for your vehicle' },
  CategoryTiles: { title: 'Shop by category' },
  PopularProducts: { title: 'Popular at {reseller}', count: POPULAR_MAX, viewAllLabel: 'View all ›' },
  PromoBanner: { title: 'Seasonal offer', text: 'Tell shoppers about an offer here.', tone: 'brand' },
  BrandStrip: { title: 'Brands we carry', brands: [] },
};

/** A relative path (`/parts`, not `//host`) or an absolute http(s) URL; anything else (`javascript:`, `data:`) is invalid. */
export function isSafeUrl(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const safeUrl = z.string().trim().refine(isSafeUrl);
const text = (max: number) => z.string().trim().min(1).max(max);
const maybeEmptyText = (max: number) => z.string().trim().max(max);

const brandItem = z.object({ name: text(80), logoUrl: safeUrl.optional().catch(undefined), href: safeUrl.optional().catch(undefined) });
const MAX_BRANDS = 24;

const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape);

/** One schema per block; every field has its own `.catch` so one bad value never discards the rest. */
const schemas = (d: AutomotiveBlockProps) => ({
  AutomotiveHero: object({
    eyebrow: maybeEmptyText(120).catch(d.AutomotiveHero.eyebrow),
    headline: text(200).catch(d.AutomotiveHero.headline),
    supportingLine: maybeEmptyText(300).catch(d.AutomotiveHero.supportingLine),
    ctaLabel: text(60).catch(d.AutomotiveHero.ctaLabel),
    ctaHref: safeUrl.catch(d.AutomotiveHero.ctaHref),
    imageUrl: safeUrl.optional().catch(undefined),
    showFinder: z.boolean().catch(d.AutomotiveHero.showFinder),
  }),
  VehicleFinder: object({ title: text(120).catch(d.VehicleFinder.title) }),
  CategoryTiles: object({ title: text(120).catch(d.CategoryTiles.title), viewAllLabel: text(60).optional().catch(d.CategoryTiles.viewAllLabel) }),
  PopularProducts: object({
    title: text(120).catch(d.PopularProducts.title),
    count: z
      .number()
      .finite()
      .transform((n) => Math.min(POPULAR_MAX, Math.max(POPULAR_MIN, Math.round(n))))
      .catch(d.PopularProducts.count),
    viewAllLabel: text(60).catch(d.PopularProducts.viewAllLabel),
  }),
  PromoBanner: object({
    title: maybeEmptyText(120).catch(d.PromoBanner.title),
    text: maybeEmptyText(400).catch(d.PromoBanner.text),
    ctaLabel: text(60).optional().catch(undefined),
    ctaHref: safeUrl.optional().catch(undefined),
    tone: z.enum(PROMO_TONES).catch(d.PromoBanner.tone),
  }),
  BrandStrip: object({
    title: maybeEmptyText(120).catch(d.BrandStrip.title ?? ''),
    brands: z
      .array(z.unknown())
      .transform((items) => items.flatMap((item) => { const r = brandItem.safeParse(item); return r.success ? [r.data] : []; }).slice(0, MAX_BRANDS))
      .catch(d.BrandStrip.brands),
  }),
});

/**
 * Props of a block from untrusted input. Invalid or missing values fall back to `DEFAULTS` (or to `overrides`, for example the
 * texts of the shopper's locale). Never throws. `count` is clamped to 4..8; a `javascript:` URL is dropped.
 */
export function parseBlockProps<N extends AutomotiveBlockName>(name: N, raw: unknown, overrides: Partial<AutomotiveBlockProps[N]> = {}): AutomotiveBlockProps[N] {
  const defaults = { ...DEFAULTS, [name]: { ...DEFAULTS[name], ...overrides } } as AutomotiveBlockProps;
  const input = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  const parsed = schemas(defaults)[name].parse(input);
  // Drop undefined keys so `{ ...props }` and toEqual stay predictable.
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as unknown as AutomotiveBlockProps[N];
}
