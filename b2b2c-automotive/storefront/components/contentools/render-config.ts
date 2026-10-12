// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The block set the storefront renders: the installed puck-renderer (0.8.3) `defaultRenderConfig` (a Nimbus-free copy of the
// editor's blocks) plus the six automotive blocks of workstream K (AutomotiveHero, VehicleFinder, CategoryTiles, PopularProducts,
// PromoBanner, BrandStrip), see ./automotive-puck-config.ts.
import { automotiveRenderConfig } from './automotive-puck-config';

export const puckRenderConfig = automotiveRenderConfig;
