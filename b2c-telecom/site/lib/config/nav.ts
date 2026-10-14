/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Only a tie-break for categories without an order hint (or with equal hints). Design order: Phone plans, Wireless internet,
// Cable internet, Add-ons, then the devices root added by G.
export const NAV_TIE_BREAK_ORDER: readonly string[] = [
  'malva-cat-phone-plans',
  'malva-cat-home-wireless',
  'malva-cat-cable-internet',
  'malva-cat-add-ons',
  'malva-cat-devices',
];

/** Static navigation entries: not part of the category tree, so they survive a catalog outage (like Support). */
export const PLAN_FINDER_PATH = '/plan-finder';

/** Root categories that are not navigation at all (their pages still exist, nothing links to them from the header, drawer or footer). */
export const HIDDEN_NAV_KEYS: readonly string[] = ['malva-cat-add-ons'];

/** The root categories grouped under the "Browse all plans" menu, in menu order, with the id of their description message. */
export const PLAN_MENU: readonly { key: string; id: 'phone' | 'wireless' | 'cable' }[] = [
  { key: 'malva-cat-phone-plans', id: 'phone' },
  { key: 'malva-cat-home-wireless', id: 'wireless' },
  { key: 'malva-cat-cable-internet', id: 'cable' },
];
