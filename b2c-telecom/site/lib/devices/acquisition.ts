// Pure module: the three ways a handset is acquired, what is due now, monthly and at the end of the term (device-acquisition-mode).
// No I/O, no commercetools; shared by the server and the client.
import { addDays, addMonths, parseDateOnly, toDateOnly } from '@/lib/pricing/dates';
import {
  EXPIRY_BUFFER_DAYS,
  FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER,
  INSTALLMENT_POLICY_PREFIX,
  INSTALLMENT_TERMS,
  LEASE_POLICY_KEY,
  LEASE_TERMS,
  RETURN_WINDOW_DAYS,
} from '@/lib/config/devices';
import type { AcquisitionMode, AcquisitionQuote, DevicePrices, EndOfTerm, InstallmentTerm, LineAcquisition, Money } from '@/lib/types';

export class AcquisitionError extends Error {
  constructor(
    readonly code: 'MODE_UNAVAILABLE' | 'TERM_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AcquisitionError';
  }
}

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];
const END_OF_TERMS: readonly EndOfTerm[] = ['owned', 'owned-after-final-payment', 'return'];

/** The recurrence policy of a mode and term; null for outright (no policy: the one-time price). */
export function policyKeyFor(mode: AcquisitionMode, termMonths: number): string | null {
  if (mode === 'installments') return `${INSTALLMENT_POLICY_PREFIX}${termMonths}`;
  if (mode === 'lease') return `malva-device-lease-${termMonths}`;
  return null;
}

/** The inverse of `policyKeyFor`; null for any key that is not a device policy (for example `malva-monthly`). */
export function modeOfPolicyKey(key: string): { mode: 'installments' | 'lease'; termMonths: number } | null {
  if (key.startsWith(INSTALLMENT_POLICY_PREFIX)) {
    const term = Number(key.slice(INSTALLMENT_POLICY_PREFIX.length));
    return (INSTALLMENT_TERMS as readonly number[]).includes(term) ? { mode: 'installments', termMonths: term } : null;
  }
  if (key === LEASE_POLICY_KEY) return { mode: 'lease', termMonths: 24 };
  return null;
}

export const isFinanced = (mode: AcquisitionMode): mode is 'installments' | 'lease' => mode !== 'outright';

export function getAvailableModes(prices: DevicePrices): { outright: boolean; installments: InstallmentTerm[]; lease: 24[] } {
  return {
    outright: prices.outright !== undefined,
    installments: INSTALLMENT_TERMS.filter((term) => prices.installments[term] !== undefined),
    lease: LEASE_TERMS.filter((term) => prices.lease[term] !== undefined),
  };
}

/** The modes that can be bought at all (a mode with at least one priced term), in display order. */
export function availableModeNames(prices: DevicePrices): AcquisitionMode[] {
  const available = getAvailableModes(prices);
  return [
    ...(available.outright ? (['outright'] as const) : []),
    ...(available.installments.length > 0 ? (['installments'] as const) : []),
    ...(available.lease.length > 0 ? (['lease'] as const) : []),
  ];
}

export function endOfTermFor(mode: AcquisitionMode): EndOfTerm {
  if (mode === 'installments') return 'owned-after-final-payment';
  return mode === 'lease' ? 'return' : 'owned';
}

/** Installments: the day of the final payment (today + term - 1 months). Lease: the return-by date (final payment + the return window). */
export function computeEndDate(mode: AcquisitionMode, termMonths: number, today: Date): string | undefined {
  if (mode === 'outright') return undefined;
  const finalPayment = addMonths(toDateOnly(today), termMonths - 1);
  return mode === 'lease' ? addDays(finalPayment, RETURN_WINDOW_DAYS) : finalPayment;
}

/** The monthly amount of a financed mode and term, or the error that names the problem. */
function monthlyOf(prices: DevicePrices, mode: 'installments' | 'lease', termMonths: number): Money {
  const amount = mode === 'installments' ? prices.installments[termMonths as InstallmentTerm] : prices.lease[termMonths as 24];
  if (amount) return amount;
  const available = getAvailableModes(prices);
  const anyTerm = mode === 'installments' ? available.installments.length > 0 : available.lease.length > 0;
  throw new AcquisitionError(anyTerm ? 'TERM_UNAVAILABLE' : 'MODE_UNAVAILABLE', anyTerm ? `The ${termMonths}-month term is not available.` : `${mode} is not available.`);
}

/**
 * What the buyer pays. Outright: the full price now. Installments and lease (Planner default): no deposit, the first monthly
 * payment is due now, the same amount follows for the remaining months. Integer arithmetic only.
 */
export function quoteAcquisition(prices: DevicePrices, mode: AcquisitionMode, termMonths: number, today: Date, quantity = 1): AcquisitionQuote {
  if (mode === 'outright') {
    if (!prices.outright) throw new AcquisitionError('MODE_UNAVAILABLE', 'outright is not available.');
    const full: Money = { centAmount: prices.outright.centAmount * quantity, currencyCode: prices.outright.currencyCode };
    return { mode, termMonths: 0, dueNow: full, totalPayable: full, endOfTerm: 'owned' };
  }
  const monthly = monthlyOf(prices, mode, termMonths);
  const amount: Money = { centAmount: monthly.centAmount * quantity, currencyCode: monthly.currencyCode };
  const endDate = computeEndDate(mode, termMonths, today);
  return {
    mode,
    termMonths,
    dueNow: amount,
    recurring: { amount, payments: termMonths, remaining: termMonths - 1 },
    totalPayable: { centAmount: amount.centAmount * termMonths, currencyCode: amount.currencyCode },
    endOfTerm: endOfTermFor(mode),
    ...(endDate ? { endDate } : {}),
  };
}

/**
 * When the Recurring Order of a financed line must expire: after the last scheduled payment and well before the next one.
 * `startsAt + (term - FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER) months + EXPIRY_BUFFER_DAYS days`; the time of day is kept.
 */
export function computeRecurringExpiry(startsAt: Date, termMonths: number): Date {
  const startDay = toDateOnly(startsAt);
  const lastDay = addDays(addMonths(startDay, termMonths - FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER), EXPIRY_BUFFER_DAYS);
  const midnight = parseDateOnly(lastDay);
  const startMidnight = parseDateOnly(startDay);
  if (!midnight || !startMidnight) throw new Error(`Invalid date ${lastDay}`);
  return new Date(midnight.getTime() + (startsAt.getTime() - startMidnight.getTime()));
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * The acquisition of a line from its custom fields. Returns null when the line has none (not a device line). NEVER infers the mode
 * from the price: a financed line whose price silently fell back to the outright price still reads as financed.
 */
export function readAcquisition(custom: Record<string, unknown> | undefined): LineAcquisition | null {
  const mode = MODES.find((candidate) => candidate === custom?.acquisitionMode);
  if (!mode) return null;
  const term = typeof custom?.acquisitionTermMonths === 'number' ? custom.acquisitionTermMonths : 0;
  const endOfTerm = END_OF_TERMS.find((candidate) => candidate === custom?.acquisitionEndOfTerm) ?? endOfTermFor(mode);
  const endDate = text(custom?.acquisitionEndDate);
  const decision = text(custom?.financingDecisionId);
  return { mode, termMonths: term, endOfTerm, ...(endDate ? { endDate: endDate.slice(0, 10) } : {}), ...(decision ? { financingDecisionId: decision } : {}) };
}
