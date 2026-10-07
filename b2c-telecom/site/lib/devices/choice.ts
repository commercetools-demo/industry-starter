// The buyer's choice on a device card (color, memory, mode, term) and how it follows the variant. Pure.
import { INSTALLMENT_TERMS } from '@/lib/config/devices';
import { availableModeNames, getAvailableModes } from '@/lib/devices/acquisition';
import type { AcquisitionMode, DeviceOffer, DevicePrices, DeviceVariant } from '@/lib/types';

export interface AcquisitionChoice {
  mode: AcquisitionMode;
  /** 0 for outright. */
  termMonths: number;
}

/** The term preferred when the buyer has not chosen one: 24 months, then the others in the order of the design. */
const TERM_PREFERENCE: readonly number[] = [24, 12, 36];

export function defaultTermFor(prices: DevicePrices, mode: AcquisitionMode): number {
  if (mode === 'outright') return 0;
  if (mode === 'lease') return 24;
  const available = getAvailableModes(prices).installments;
  return TERM_PREFERENCE.find((term) => (available as number[]).includes(term)) ?? INSTALLMENT_TERMS[0] ?? 12;
}

/**
 * Keeps a choice valid for a variant: a mode the variant does not offer becomes installments (or pay in full when it has none), and
 * an installment term without a price becomes the preferred available term. A valid choice is returned unchanged.
 */
export function normalizeChoice(prices: DevicePrices, choice: AcquisitionChoice): AcquisitionChoice {
  const modes = availableModeNames(prices);
  const mode: AcquisitionMode = modes.includes(choice.mode) ? choice.mode : (modes.find((candidate) => candidate === 'installments') ?? modes[0] ?? 'outright');
  if (mode === 'outright') return { mode, termMonths: 0 };
  const available: number[] = mode === 'installments' ? getAvailableModes(prices).installments : getAvailableModes(prices).lease;
  if (mode === choice.mode && available.includes(choice.termMonths)) return choice;
  return { mode, termMonths: defaultTermFor(prices, mode) };
}

/** The variant of a color and memory, or undefined when the offer has no such combination. */
export function findVariant(offer: DeviceOffer, color: string, memoryGb: number): DeviceVariant | undefined {
  return offer.variants.find((variant) => variant.color === color && variant.memoryGb === memoryGb);
}

/** The first choice of a card: the master variant, installments over 24 months when offered, else pay in full. */
export function initialChoice(offer: DeviceOffer): { variant: DeviceVariant; choice: AcquisitionChoice } | null {
  const variant = offer.variants[0];
  if (!variant) return null;
  return { variant, choice: normalizeChoice(variant.prices, { mode: 'installments', termMonths: 24 }) };
}
