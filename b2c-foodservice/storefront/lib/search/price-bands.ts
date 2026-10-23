// Price bands for the listing price facet (Q-G-05). Minor units; `from` inclusive, `to` exclusive.
export interface PriceBand { id: 'p0' | 'p1' | 'p2' | 'p3' | 'p4'; from?: number; to?: number }

const BANDS: PriceBand[] = [
  { id: 'p0', to: 1000 },
  { id: 'p1', from: 1000, to: 2500 },
  { id: 'p2', from: 2500, to: 10000 },
  { id: 'p3', from: 10000, to: 25000 },
  { id: 'p4', from: 25000 },
];

/** Same shape for every currency today; the currency argument is the extension point for a market with other bands. */
export function priceBands(currency: string): PriceBand[] {
  void currency;
  return BANDS.map((b) => ({ ...b }));
}

export const PRICE_BAND_IDS: readonly string[] = BANDS.map((b) => b.id);

export function priceBandById(currency: string, id: string): PriceBand | undefined {
  return priceBands(currency).find((b) => b.id === id);
}
