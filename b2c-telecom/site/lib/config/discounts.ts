// Discount amounts in cents, used by BOTH the seeded Cart Discounts (scripts/seed/data/cart-discounts*.ts) and the
// "Discounts & Bundles" text of the Broadband Facts label, so no figure exists in two places.
// The values equal what workstream G already seeded live (`malva-cd-second-line-10`, `malva-cd-bundle-5`).
export const DISCOUNT_AMOUNTS = {
  secondLine: { USD: 1000, EUR: 1000 },
  bundleCablePhone: { USD: 500, EUR: 500 },
  codeCable5: { USD: 500, EUR: 500 },
} as const;

/** Cart Discount keys the bundle prompt reads (`includedDiscounts[].discount.key`). */
export const DISCOUNT_KEYS = {
  secondLine: 'malva-cd-second-line-10',
  bundleCablePhone: 'malva-cd-bundle-5',
  codeCable5: 'malva-cd-code-cable5',
} as const;

/** The Discount Code `MALVA-CABLE5` (workstream M seeds it). */
export const CABLE5_CODE = { key: 'malva-dc-cable5', code: 'MALVA-CABLE5' } as const;
