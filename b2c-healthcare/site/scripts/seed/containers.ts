/**
 * Every Custom Object container the storefront (and the seed) writes: the values of `CONTAINERS` in lib/ct/custom-objects.ts
 * plus the ones the seed script writes. A unit test (reset.test.ts) reads lib/ct/custom-objects.ts and fails when this list
 * misses a container, so the full reset cannot silently leave one behind.
 */
export const MALVA_CONTAINERS = [
  'malva-schedule',
  'malva-slot-claim',
  'malva-booking',
  'malva-rx',
  'malva-lab',
  'malva-credential',
  'malva-counter',
  'malva-ratelimit',
  'malva-dispense-ledger',
  'malva-order-attempt',
  'malva-refill-log',
  'malva-allowance',
  'malva-allowance-ledger',
] as const;

/** Containers all start with this; the reset also removes any other container with the prefix it finds. */
export const CONTAINER_PREFIX = 'malva-';
