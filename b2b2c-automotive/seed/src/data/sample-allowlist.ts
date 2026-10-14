// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/**
 * THE ONLY things seed:cleanup may delete: the sample data the project key spec-test-b2b2c-automotive came with, read
 * through the read-only MCP on 2026-10-12 (72 products, 42 categories, 3 product types, 2 shipping methods, 1 tax
 * category, 2 zones, 78 standalone prices, 8 channels, 2 product discounts, 2 cart discounts, 4 recurrence policies).
 * Nothing is matched by pattern. A key starting with `mau-` is refused even if it is listed here. Associate roles of
 * the sample (approver, ...) are NOT touched (see SEED-PLAN.md, Q-S07).
 */
export const SAMPLE_ALLOWLIST = {
  products: [
    'a789-bc', 'aa123-qr', 'aaa789-uv', 'air-filter',
    'alternator', 'b456-st', 'bb456-st', 'bbb234-wx',
    'brake-pad-set', 'c789-uv', 'cc789-uv', 'ccc567-yz',
    'd234-wx', 'dd234-wx', 'ddd890-op', 'e567-yz',
    'ee567-yz', 'eee123-qr', 'f890-op', 'ff890-op',
    'fff456-st', 'fuel-filter', 'g123-qr', 'gg123-qr',
    'ggg789-uv', 'h456-st', 'hh456-st', 'hhh234-wx',
    'hydraulic-hose', 'i789-uv', 'ii789-uv', 'iii567-yz',
    'j234-wx', 'jj234-wx', 'jjj890-op', 'k567-yz',
    'kk567-yz', 'l890-op', 'led-work-light', 'll890-op',
    'm890-op', 'mm123-qr', 'n123-qr', 'nn456-st',
    'oil-filter', 'oo789-uv', 'p234-qw', 'pin-and-bushing-kit',
    'piston-ring-set', 'pneumatic-tire', 'pp234-wx', 'qq567-yz',
    'r123-ts', 'rr890-op', 's567-uv', 'ss123-qr',
    'starter-motor', 'tapered-roller-bearing', 'tt456-st', 'u123-qr',
    'uu789-uv', 'v456-st', 'vv234-wx', 'w789-uv',
    'ww567-yz', 'x234-wx', 'x456-yz', 'xx890-op',
    'y567-yz', 'yy123-qr', 'z890-op', 'zz456-st',
  ],
  categories: [
    'airport-graders', 'amphibious-excavators', 'articulated-dump-trucks', 'blasthole-drills',
    'construction-loaders', 'crawler-cranes', 'deep-mining-excavators', 'demolition-hammers',
    'dump-trucks', 'earthmoving-bulldozers', 'excavators', 'exploration-drills',
    'fine-graders', 'heavy-duty-construction-cranes', 'heavy-duty-soil-compactors-rollers', 'high-capacity-front-end-loaders',
    'high-capacity-motor-graders', 'landfill-compactors', 'large-bulldozers', 'large-diameter-mining-drills',
    'large-hydraulic-hammers', 'large-scale-mining-excavators', 'large-wheel-excavators', 'log-loaders',
    'mobile-cranes', 'off-highway-dump-trucks', 'piling-hammers', 'pneumatic-rollers',
    'production-drills', 'quarry-loaders', 'quarrying-hammers', 'railroad-wheeled-excavators',
    'rigid-dump-trucks', 'road-graders', 'spare-parts', 'surface-mining-excavators',
    'swamp-bulldozers', 'tower-cranes', 'vibratory-soil-compactors', 'waste-handling-bulldozers',
    'wheeled-excavators-for-construction', 'wheeled-excavators-for-mining',
  ],
  'product-types': [
    'generic-product', 'heavy-earthmoving-and-construction-equipment', 'heavy-lifting-and-specialized-equipment',
  ],
  'shipping-methods': [
    'standard-shipping-method', 'premium-shipping-method',
  ],
  'tax-categories': [
    'standard-tax',
  ],
  zones: [
    'europe', 'north-america',
  ],
  channels: [
    'eu-warehouse', 'spain', 'us-warehouse', 'us-large-customers',
    'default-channel', 'us-medium-customers', 'de-fr-uk', 'default-warehouse',
  ],
  'product-discounts': [
    'dump-trucks-15-pct-off', 'spare-parts-5-eur-off',
  ],
  'cart-discounts': [
    'free-ship-50000-gbp', 'tower-cranes-bogo',
  ],
  'recurrence-policies': [
    'policy-monthly', 'policy-quarterly', 'policy-biannually', 'policy-yearly',
  ],
  /** Standalone prices are matched by the SKU they belong to (their keys are `<sku>-<n>` or `<sku>-<CUR>-<policy>`). */
  'standalone-price-skus': [
    'air-filter', 'alternator', 'brake-pad-set', 'fuel-filter',
    'hydraulic-hose', 'oil-filter', 'tapered-roller-bearing',
  ],
} as const;

export type AllowKind = keyof typeof SAMPLE_ALLOWLIST;
