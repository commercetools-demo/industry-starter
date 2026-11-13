// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ChannelDraft, ProductSelectionDraft } from '@commercetools/platform-sdk';
import { ls } from './base';

/** One product selection per brand (mode Individual): Product Search is filtered by it in the storefront. */
export const SELECTION_COFFEE = 'mcf-selection-malva-coffee';
export const SELECTION_DRINKS = 'mcf-selection-malva-drinks';

/**
 * Inventory (supply) channel of Malva Drinks. The key has no `mcf-store-` prefix, so the storefront's store mapper never
 * shows it as a collection store. Drinks stock lives only on this channel (no online entry).
 */
export const CHANNEL_DRINKS = 'mcf-channel-malva-drinks';

export const selectionDrafts: ProductSelectionDraft[] = [
  { key: SELECTION_COFFEE, name: ls('Malva Coffee'), mode: 'Individual' },
  { key: SELECTION_DRINKS, name: ls('Malva Drinks'), mode: 'Individual' },
];

export const drinksChannelDraft = (): ChannelDraft => ({
  key: CHANNEL_DRINKS, roles: ['InventorySupply'], name: ls('Malva Drinks warehouse'), description: ls('Inventory of Malva Drinks (delivery only)'),
});
