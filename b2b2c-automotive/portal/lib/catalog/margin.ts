// Distance of a reseller price from the Malva list price: information only, neutral tone (owner Q-T03, Q-V01).
// There is no cost price, so there is no margin, no chip, no "thin" and no "below cost".
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Percent (one decimal) a price is below the list price; 0 when it is at or above the list. */
export function belowListPercent(priceCent: number, listCent: number): number {
  if (!(listCent > 0)) return 0;
  return round1(Math.max(0, ((listCent - priceCent) / listCent) * 100));
}

/** Percent (one decimal) a price is above the list price; 0 when it is at or below the list. */
export function aboveListPercent(priceCent: number, listCent: number): number {
  if (!(listCent > 0)) return 0;
  return round1(Math.max(0, ((priceCent - listCent) / listCent) * 100));
}

export type ListDistance = { direction: 'below' | 'above' | 'equal'; percent: number };

export function listDistance(priceCent: number, listCent: number): ListDistance {
  const below = belowListPercent(priceCent, listCent);
  const above = aboveListPercent(priceCent, listCent);
  if (below > 0) return { direction: 'below', percent: below };
  if (above > 0) return { direction: 'above', percent: above };
  return { direction: 'equal', percent: 0 };
}

/** The tone is always neutral: a low price is the reseller's decision, not a warning. */
export const LIST_DISTANCE_TONE = 'neutral' as const;
