/**
 * Eligible-item tender restriction (workstream U, eligible-item-tender-restriction; Q-063). Pure rules, no server
 * imports.
 *
 * The product attribute `hsaEligible` is copied to the cart line as `custom.eligibleForRestricted` when the line is
 * added (never read live afterwards). The restricted instrument ("Health account card (demo)") may pay only for the
 * eligible lines: its cap is the ELIGIBLE SUBTOTAL, the money value of those lines after discounts. Delivery is never
 * eligible and never enters the split.
 */

export interface BasketLine {
  id: string;
  eligible: boolean;
  /** Cents the line costs the patient after line-level discounts (the platform line total). */
  amount: number;
}

export interface SplitLine {
  id: string;
  eligible: boolean;
  /** Cents after the pro-rata share of any basket-level discount. */
  amount: number;
}

export type BasketKind = 'wholly-eligible' | 'mixed' | 'none-eligible';

export interface BasketSplit {
  eligibleSubtotal: number;
  ineligibleSubtotal: number;
  perLine: SplitLine[];
  kind: BasketKind;
}

/**
 * Splits a basket into its eligible and ineligible value. `discount` is a basket-level discount in cents that is not
 * already in the line amounts (for example a code on the whole order): it is apportioned across the lines pro rata to
 * their amounts (largest remainder, so the parts add up to it exactly), never below zero per line. Shipping is not a
 * basket line and is excluded by construction.
 */
export function splitBasket(lines: BasketLine[], discount = 0): BasketSplit {
  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  const off = Math.min(Math.max(0, Math.floor(discount)), gross);
  const shares = lines.map((l) => (gross === 0 ? 0 : (off * l.amount) / gross));
  const floors = shares.map((s) => Math.floor(s));
  let left = off - floors.reduce((a, b) => a + b, 0);
  const order = shares.map((s, i) => ({ i, rest: s - Math.floor(s) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (floors[i]! < lines[i]!.amount) {
      floors[i]! += 1;
      left -= 1;
    }
  }
  const perLine = lines.map((l, i): SplitLine => ({ id: l.id, eligible: l.eligible, amount: l.amount - floors[i]! }));
  const eligibleSubtotal = perLine.filter((l) => l.eligible).reduce((sum, l) => sum + l.amount, 0);
  const ineligibleSubtotal = perLine.filter((l) => !l.eligible).reduce((sum, l) => sum + l.amount, 0);
  const kind: BasketKind = eligibleSubtotal === 0 ? 'none-eligible' : ineligibleSubtotal === 0 ? 'wholly-eligible' : 'mixed';
  return { eligibleSubtotal, ineligibleSubtotal, perLine, kind };
}
