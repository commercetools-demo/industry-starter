'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Puck configuration of the portal's Content editors: the package's default blocks plus the six automotive blocks the
// storefront renders (hero, vehicle finder, category tiles, popular products, promo banner, brand strip). The real components
// live in the storefront, so here each block only has fields and a lightweight preview (a labelled box built from admin-kit
// tokens). Block type names and props come from `blocks-contract.ts`, a copy of the storefront contract.
import { defaultPuckConfig } from '@commercetools-demo/puck-editor';
import type { ComponentConfig, Config } from '@measured/puck';
import type { ReactNode } from 'react';
import {
  AUTOMOTIVE_BLOCKS,
  DEFAULTS,
  type AutomotiveHeroProps,
  type BrandStripProps,
  type CategoryTilesProps,
  type PopularProductsProps,
  type PromoBannerProps,
  type VehicleFinderProps,
} from './blocks-contract';

function Preview({ label, title, lines, children }: { label: string; title?: string; lines?: Array<string | undefined>; children?: ReactNode }) {
  return (
    <div className="m-200 rounded-300 border border-border bg-bg-surface-subdued p-400 text-text">
      <p className="text-caption-1 font-bold text-text-subdued">{label}</p>
      {title ? <p className="text-title-2 font-semibold">{title}</p> : null}
      {lines?.filter(Boolean).map((line) => (
        <p key={line} className="text-body-2 text-text-subdued">
          {line}
        </p>
      ))}
      {children}
    </div>
  );
}

const hero: ComponentConfig<AutomotiveHeroProps> = {
  label: 'Hero with vehicle finder',
  fields: {
    eyebrow: { type: 'text', label: 'Label' },
    headline: { type: 'text', label: 'Headline' },
    supportingLine: { type: 'textarea', label: 'Supporting line ({city}, {pickup})' },
    ctaLabel: { type: 'text', label: 'Button label' },
    ctaHref: { type: 'text', label: 'Button link' },
    imageUrl: { type: 'text', label: 'Image URL (https)' },
    showFinder: { type: 'radio', label: 'Vehicle finder', options: [{ label: 'Show', value: true }, { label: 'Hide', value: false }] },
  },
  defaultProps: DEFAULTS.AutomotiveHero,
  render: (p) => (
    <Preview label={`AutomotiveHero${p.showFinder ? ' + finder' : ''}`} title={p.headline} lines={[p.eyebrow, p.supportingLine, p.ctaLabel ? `[${p.ctaLabel}]` : undefined]}>
      {p.imageUrl ? <p className="text-caption-2 text-text-subdued">{p.imageUrl}</p> : null}
    </Preview>
  ),
};

const finder: ComponentConfig<VehicleFinderProps> = {
  label: 'Vehicle finder',
  fields: { title: { type: 'text', label: 'Title' } },
  defaultProps: DEFAULTS.VehicleFinder,
  render: (p) => <Preview label="VehicleFinder" title={p.title} />,
};

const tiles: ComponentConfig<CategoryTilesProps> = {
  label: 'Category tiles',
  fields: { title: { type: 'text', label: 'Title' }, viewAllLabel: { type: 'text', label: 'View all label' } },
  defaultProps: DEFAULTS.CategoryTiles,
  render: (p) => <Preview label="CategoryTiles" title={p.title} lines={[p.viewAllLabel]} />,
};

const popular: ComponentConfig<PopularProductsProps> = {
  label: 'Popular products',
  fields: {
    title: { type: 'text', label: 'Title' },
    count: { type: 'number', label: 'Number of products (4 to 8)', min: 4, max: 8 },
    viewAllLabel: { type: 'text', label: 'View all label' },
  },
  defaultProps: DEFAULTS.PopularProducts,
  render: (p) => <Preview label="PopularProducts" title={p.title} lines={[`${p.count} products`, p.viewAllLabel]} />,
};

const promo: ComponentConfig<PromoBannerProps> = {
  label: 'Promo banner',
  fields: {
    title: { type: 'text', label: 'Title' },
    text: { type: 'textarea', label: 'Text' },
    ctaLabel: { type: 'text', label: 'Button label' },
    ctaHref: { type: 'text', label: 'Button link' },
    tone: { type: 'select', label: 'Tone', options: [{ label: 'Brand', value: 'brand' }, { label: 'Accent', value: 'accent' }, { label: 'Neutral', value: 'neutral' }] },
  },
  defaultProps: DEFAULTS.PromoBanner,
  render: (p) => <Preview label={`PromoBanner · ${p.tone}`} title={p.title} lines={[p.text, p.ctaLabel ? `[${p.ctaLabel}]` : undefined]} />,
};

const brands: ComponentConfig<BrandStripProps> = {
  label: 'Brand strip',
  fields: {
    title: { type: 'text', label: 'Title' },
    brands: {
      type: 'array',
      label: 'Brands',
      getItemSummary: (item) => item.name || 'Brand',
      arrayFields: { name: { type: 'text', label: 'Name' }, logoUrl: { type: 'text', label: 'Logo URL (https)' }, href: { type: 'text', label: 'Link' } },
      defaultItemProps: { name: 'Brand name' },
    },
  },
  defaultProps: DEFAULTS.BrandStrip,
  render: (p) => <Preview label="BrandStrip" title={p.title} lines={[p.brands.map((b) => b.name).join(' · ')]} />,
};

/** Components added to the editor, keyed by the storefront block type name. */
export const automotiveComponents = { AutomotiveHero: hero, VehicleFinder: finder, CategoryTiles: tiles, PopularProducts: popular, PromoBanner: promo, BrandStrip: brands } as const;

export const portalPuckConfig: Config = {
  ...defaultPuckConfig,
  categories: {
    ...defaultPuckConfig.categories,
    automotive: { title: 'Automotive', components: [...AUTOMOTIVE_BLOCKS] },
  },
  components: {
    ...defaultPuckConfig.components,
    ...(automotiveComponents as unknown as Config['components']),
  },
};
