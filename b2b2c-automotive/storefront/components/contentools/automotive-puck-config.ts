// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The render config of the storefront: the installed defaultRenderConfig plus the six automotive blocks (workstream K).
// Field definitions live in lib/puck/automotive-fields.ts (framework free, copied to the portal by workstream U).
import { defaultRenderConfig } from '@commercetools-demo/puck-renderer';
import type { PuckComponentConfig, PuckConfig } from '@commercetools-demo/puck-types';
import { createElement } from 'react';
import { AutomotiveHero } from '@/components/home/AutomotiveHero';
import { BrandStrip } from '@/components/home/BrandStrip';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { PopularProducts } from '@/components/home/PopularProducts';
import { PromoBanner } from '@/components/home/PromoBanner';
import { VehicleFinderBlock } from '@/components/home/VehicleFinderBlock';
import { AUTOMOTIVE_FIELDS, AUTOMOTIVE_LABELS } from '@/lib/puck/automotive-fields';
import { AUTOMOTIVE_BLOCKS, DEFAULTS, type AutomotiveBlockName } from '@/lib/puck/automotive-blocks.schema';

type BlockComponent = (props: Record<string, unknown>) => React.ReactNode;
const BLOCKS: Record<AutomotiveBlockName, BlockComponent> = {
  AutomotiveHero,
  VehicleFinder: VehicleFinderBlock,
  CategoryTiles,
  PopularProducts,
  PromoBanner,
  BrandStrip,
};

const entry = (name: AutomotiveBlockName): PuckComponentConfig =>
  ({
    label: AUTOMOTIVE_LABELS[name],
    fields: AUTOMOTIVE_FIELDS[name],
    defaultProps: DEFAULTS[name],
    // An element (not a call) so the block's hooks run inside its own component.
    render: (props: Record<string, unknown>) => createElement(BLOCKS[name], props),
  }) as unknown as PuckComponentConfig;

export const automotiveComponents = Object.fromEntries(AUTOMOTIVE_BLOCKS.map((name) => [name, entry(name)]));

export const automotiveRenderConfig = {
  ...defaultRenderConfig,
  components: { ...defaultRenderConfig.components, ...automotiveComponents },
} as PuckConfig;
