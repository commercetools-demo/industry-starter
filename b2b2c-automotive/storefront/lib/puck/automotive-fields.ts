// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Puck editor field definitions of the six automotive blocks (no React, type imports only). Workstream U copies this file next to
// `automotive-blocks.schema.ts` into `portal/` and registers the same blocks in the PageManager config:
//   components: { AutomotiveHero: { label, fields: AUTOMOTIVE_FIELDS.AutomotiveHero, defaultProps: DEFAULTS.AutomotiveHero, render }, ... }
import type { Fields } from '@commercetools-demo/puck-types';
import { AUTOMOTIVE_BLOCKS, PROMO_TONES, type AutomotiveBlockName } from './automotive-blocks.schema';

export const AUTOMOTIVE_LABELS: Record<AutomotiveBlockName, string> = {
  AutomotiveHero: 'Automotive hero',
  VehicleFinder: 'Vehicle finder',
  CategoryTiles: 'Category tiles',
  PopularProducts: 'Popular products',
  PromoBanner: 'Promo banner',
  BrandStrip: 'Brand strip',
};

export const AUTOMOTIVE_FIELDS: Record<AutomotiveBlockName, Fields> = {
  AutomotiveHero: {
    eyebrow: { type: 'text', label: 'Label above the headline' },
    headline: { type: 'text', label: 'Headline (use {reseller} for the store name)' },
    supportingLine: { type: 'textarea', label: 'Supporting line ({city}, {pickup}); empty shows the automatic pickup promise' },
    ctaLabel: { type: 'text', label: 'Button label' },
    ctaHref: { type: 'text', label: 'Button link (a path such as /parts, or an https URL)' },
    imageUrl: { type: 'text', label: 'Background image URL (decorative, optional)' },
    showFinder: {
      type: 'radio',
      label: 'Vehicle finder card',
      options: [
        { label: 'Show', value: true },
        { label: 'Hide', value: false },
      ],
    },
  },
  VehicleFinder: { title: { type: 'text', label: 'Title' } },
  CategoryTiles: { title: { type: 'text', label: 'Title' }, viewAllLabel: { type: 'text', label: 'View all link label (optional)' } },
  PopularProducts: {
    title: { type: 'text', label: 'Title (use {reseller} for the store name)' },
    count: { type: 'number', label: 'Products shown (4 to 8)', min: 4, max: 8 },
    viewAllLabel: { type: 'text', label: 'View all link label' },
  },
  PromoBanner: {
    title: { type: 'text', label: 'Title' },
    text: { type: 'textarea', label: 'Text (plain text)' },
    ctaLabel: { type: 'text', label: 'Button label (optional)' },
    ctaHref: { type: 'text', label: 'Button link (optional)' },
    tone: { type: 'radio', label: 'Tone', options: PROMO_TONES.map((value) => ({ label: value, value })) },
  },
  BrandStrip: {
    title: { type: 'text', label: 'Title (optional)' },
    brands: {
      type: 'array',
      label: 'Brands',
      getItemSummary: (item: { name?: string }) => item.name || 'Brand',
      defaultItemProps: { name: 'Brand', logoUrl: '', href: '' },
      arrayFields: {
        name: { type: 'text', label: 'Name (alt text of the logo)' },
        logoUrl: { type: 'text', label: 'Logo URL (optional)' },
        href: { type: 'text', label: 'Link (optional)' },
      },
    },
  },
};

export { AUTOMOTIVE_BLOCKS };
