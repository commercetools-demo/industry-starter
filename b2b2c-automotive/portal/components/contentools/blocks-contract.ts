// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The automotive Puck block contract, COPIED (the apps are separate packages, no workspace) from workstream K's plan section 4
// (`plans/workstreams/K-home-page-puck.md`), which defines `storefront/lib/puck/automotive-blocks.schema.ts`.
// Block type names and prop names must stay identical to the storefront file; `puck-config.test.ts` compares the type names with
// that file as soon as it exists. If K changes a name or a prop, adopt K's (the reader defines the contract).

export const AUTOMOTIVE_BLOCKS = ['AutomotiveHero', 'VehicleFinder', 'CategoryTiles', 'PopularProducts', 'PromoBanner', 'BrandStrip'] as const;
export type AutomotiveBlockName = (typeof AUTOMOTIVE_BLOCKS)[number];

export interface AutomotiveHeroProps {
  eyebrow: string;
  headline: string;
  /** May contain {city} and {pickup}. */
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
  tone: 'brand' | 'accent' | 'neutral';
}
export interface BrandStripProps {
  title?: string;
  brands: Array<{ name: string; logoUrl?: string; href?: string }>;
}

export interface BlockPropsByName {
  AutomotiveHero: AutomotiveHeroProps;
  VehicleFinder: VehicleFinderProps;
  CategoryTiles: CategoryTilesProps;
  PopularProducts: PopularProductsProps;
  PromoBanner: PromoBannerProps;
  BrandStrip: BrandStripProps;
}

/** Starting values for a block dropped into the editor (English; the editor user rewrites them). */
export const DEFAULTS: { [K in AutomotiveBlockName]: BlockPropsByName[K] } = {
  AutomotiveHero: {
    eyebrow: 'OEM parts · Fit guaranteed',
    headline: 'Genuine parts, ready near you.',
    supportingLine: 'Pick up in {city} today or have it shipped.',
    ctaLabel: 'Shop all parts',
    ctaHref: '/',
    showFinder: true,
  },
  VehicleFinder: { title: 'Find parts for your vehicle' },
  CategoryTiles: { title: 'Shop by category', viewAllLabel: 'View all' },
  PopularProducts: { title: 'Popular products', count: 4, viewAllLabel: 'View all' },
  PromoBanner: { title: 'This week', text: 'Tell shoppers about an offer.', tone: 'brand' },
  BrandStrip: { title: 'Brands we carry', brands: [{ name: 'Brand name' }] },
};
