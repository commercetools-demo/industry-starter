// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/**
 * Pure preset pricing (workstream V, D2). Money is integer minor units. The preset discount is a fraction
 * (0.1 = 10 %). The sum is rounded once, after the multiplication, never per component.
 */

export interface PresetPrice {
  /** Sum of the components' effective unit prices (the struck-through price). */
  was: number;
  /** The bundle's unit price: `round(was × (1 − discount))`. */
  price: number;
  /** `was − price`; 0 for a discount of 0. */
  save: number;
}

/** A discount is valid when it is a finite number from 0 (inclusive) to 1 (exclusive). Anything else hides the preset. */
export function isValidDiscount(discount: unknown): discount is number {
  return typeof discount === 'number' && Number.isFinite(discount) && discount >= 0 && discount < 1;
}

const isMinorUnits = (cents: unknown): cents is number =>
  typeof cents === 'number' && Number.isSafeInteger(cents) && cents >= 0;

/** Price of a preset from its components' unit prices (minor units). Null for an invalid discount, no parts or a bad amount. */
export function presetPrice(componentCents: readonly number[], discount: unknown): PresetPrice | null {
  if (!isValidDiscount(discount) || componentCents.length === 0 || !componentCents.every(isMinorUnits)) return null;
  const was = componentCents.reduce((sum, cents) => sum + cents, 0);
  const price = Math.round(was * (1 - discount));
  return { was, price, save: was - price };
}
