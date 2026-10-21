import type { AvailabilityState } from '@/lib/types';

/** Zero or less is out, at or below the threshold is low, above it is in. */
export function availabilityState(quantity: number, lowThreshold: number): AvailabilityState {
  if (quantity <= 0) return 'out';
  return quantity <= lowThreshold ? 'low' : 'in';
}

/** Message keys (under `store.picker`) for the per-store availability line. */
export const AVAILABILITY_LABEL_KEY = {
  in: 'availability.in',
  low: 'availability.low',
  out: 'availability.out',
} as const satisfies Record<AvailabilityState, string>;
