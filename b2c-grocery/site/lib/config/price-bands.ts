/** Price bands in minor units (cents). `min` inclusive, `max` exclusive. */
export interface PriceBand { id: string; min?: number; max?: number }

const BANDS: PriceBand[] = [
  { id: 'lt-500', max: 500 },
  { id: '500-1500', min: 500, max: 1500 },
  { id: '1500-3000', min: 1500, max: 3000 },
  { id: 'gt-3000', min: 3000 },
];

const BANDS_BY_CURRENCY: Record<string, PriceBand[]> = { USD: BANDS, EUR: BANDS };

export function getPriceBands(currency: string): PriceBand[] {
  const bands = BANDS_BY_CURRENCY[currency];
  if (!bands) throw new Error(`No price bands configured for currency ${currency}`);
  return bands;
}
