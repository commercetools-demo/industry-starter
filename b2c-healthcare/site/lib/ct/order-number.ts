import 'server-only';
import { ORDER_NUMBER_DIGITS, ORDER_NUMBER_PREFIX } from '@/lib/checkout/config';
import { CONTAINERS, createOnly, getObject, putObject, statusOf } from '@/lib/ct/custom-objects';

/**
 * Order numbers (`MLV-000042`) come from a counter Custom Object (`malva-counter` / `order-number`), not from the
 * browser and not from a random id. The counter holds the NEXT number to hand out. Each number is taken with an
 * optimistic-concurrency write (`version` = the version read): two requests that read the same version cannot both
 * succeed, so a number is handed out at most once; the loser re-reads and tries again.
 *
 * A number taken for an order that then fails to be created is not reused (a gap in the sequence is harmless; a
 * duplicate is not). The platform also enforces uniqueness of `orderNumber`.
 */

export const ORDER_COUNTER_KEY = 'order-number';
const MAX_ATTEMPTS = 12;

interface CounterValue {
  next: number;
}

export class OrderNumberContendedError extends Error {
  constructor() {
    super('order number counter is contended; try again');
    this.name = 'OrderNumberContendedError';
  }
}

export function formatOrderNumber(n: number): string {
  return `${ORDER_NUMBER_PREFIX}${String(n).padStart(ORDER_NUMBER_DIGITS, '0')}`;
}

/** Takes the next order number. Throws `OrderNumberContendedError` after repeated version conflicts. */
export async function nextOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await getObject<CounterValue>(CONTAINERS.counter, ORDER_COUNTER_KEY);
    if (!stored) {
      // First order ever: create-only (`version: 0`); if another request created it first, re-read.
      if (await createOnly<CounterValue>(CONTAINERS.counter, ORDER_COUNTER_KEY, { next: 2 })) return formatOrderNumber(1);
      continue;
    }
    const n = Number.isInteger(stored.value.next) && stored.value.next >= 1 ? stored.value.next : 1;
    try {
      await putObject<CounterValue>(CONTAINERS.counter, ORDER_COUNTER_KEY, { next: n + 1 }, stored.version);
      return formatOrderNumber(n);
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  throw new OrderNumberContendedError();
}
