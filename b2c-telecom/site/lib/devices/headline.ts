// The two prices of a device card: the lowest monthly amount over the longest installment term, and the lowest outright price. Pure.
import { INSTALLMENT_TERMS } from '@/lib/config/devices';
import type { DeviceOffer, Money } from '@/lib/types';

const lowest = (values: Money[]): Money | undefined => values.reduce<Money | undefined>((best, value) => (!best || value.centAmount < best.centAmount ? value : best), undefined);

/** `fromMonthly`: the lowest monthly installment over the longest term that any variant offers (36 months for both handsets). */
export function deviceHeadline(offer: DeviceOffer): { fromMonthly?: Money; outright?: Money } {
  const longestFirst = [...INSTALLMENT_TERMS].sort((a, b) => b - a);
  const term = longestFirst.find((candidate) => offer.variants.some((variant) => variant.prices.installments[candidate] !== undefined));
  const monthly = term === undefined ? undefined : lowest(offer.variants.flatMap((variant) => (variant.prices.installments[term] ? [variant.prices.installments[term]] : [])));
  const outright = lowest(offer.variants.flatMap((variant) => (variant.prices.outright ? [variant.prices.outright] : [])));
  return { ...(monthly ? { fromMonthly: monthly } : {}), ...(outright ? { outright } : {}) };
}
