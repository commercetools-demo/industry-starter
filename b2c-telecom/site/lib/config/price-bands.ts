import type { CurrencyCode, PriceBand } from '@/lib/types';

// Minor units; min inclusive, max exclusive. Applied to the headline recurring amount (the one-time amount when there is none).
const BANDS: readonly PriceBand[] = [
  { id: 'lt-25', max: 2500 },
  { id: '25-50', min: 2500, max: 5000 },
  { id: '50-75', min: 5000, max: 7500 },
  { id: 'gt-75', min: 7500 },
];

export const PRICE_BANDS: Record<CurrencyCode, readonly PriceBand[]> = { USD: BANDS, EUR: BANDS };

export function getPriceBands(currency: string): readonly PriceBand[] {
  if (currency !== 'USD' && currency !== 'EUR') throw new Error(`No price bands for currency ${currency}`);
  return PRICE_BANDS[currency];
}

export const inBand = (band: PriceBand, centAmount: number): boolean =>
  (band.min === undefined || centAmount >= band.min) && (band.max === undefined || centAmount < band.max);
