// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The block set the storefront renders. The installed puck-renderer (0.8.3) exports `defaultRenderConfig` (a Nimbus-free
// copy of the editor's blocks); `defaultPuckConfig` of puck-editor is the editor-side twin and is not used here.
// Workstream K extends this config with the automotive blocks (AutomotiveHero, CategoryTiles, ...).
import { defaultRenderConfig } from '@commercetools-demo/puck-renderer';

export const puckRenderConfig = defaultRenderConfig;
