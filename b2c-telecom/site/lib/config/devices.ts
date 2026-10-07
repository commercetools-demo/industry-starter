// Constants of the device acquisition modes (workstream Q, D-015, D-060). Never inline these numbers.
import type { InstallmentTerm } from '@/lib/types';

/** A leased device must be returned within this many days of the final payment. */
export const RETURN_WINDOW_DAYS = 30;
export const INSTALLMENT_TERMS: readonly InstallmentTerm[] = [12, 24, 36];
export const LEASE_TERMS: readonly 24[] = [24];
export const MAX_DEVICE_QUANTITY = 3;
/** Stub financing limit on the sum of monthly x term x quantity, in minor units (Planner default; the owner may overrule, M-Q-2). */
export const FINANCING_LIMIT_CENTS = { USD: 250000, EUR: 230000 } as const;
/**
 * Number of the payment that falls at the Recurring Order's `startsAt`. The initial Order (paid at checkout) is payment 1 and sits
 * at `startsAt`; MEASURED live (`npm run spike:device-recurrence`, 2026-10-07): `nextOrderAt` = `startsAt` + 1 month, so the first
 * generated order is payment 2 one month later and the last payment N is at `startsAt` + (N - 1) months.
 */
export const FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER = 1;
export const POLICY_CACHE_SECONDS = 300;
/** Added after the last scheduled payment so month-end clamping and processing delay never create one more order. */
export const EXPIRY_BUFFER_DAYS = 7;
/** `applyDeviceRecurringExpiry` polls this many times, this many milliseconds apart. */
export const EXPIRY_POLL_ATTEMPTS = 5;
export const EXPIRY_POLL_INTERVAL_MS = 2000;

export const INSTALLMENT_POLICY_PREFIX = 'malva-device-installment-';
export const LEASE_POLICY_KEY = 'malva-device-lease-24';
export const DEVICE_POLICY_KEYS: readonly string[] = [...INSTALLMENT_TERMS.map((term) => `${INSTALLMENT_POLICY_PREFIX}${term}`), LEASE_POLICY_KEY];

/** Custom type of the line items. */
export const LINE_ITEM_TYPE_KEY = 'malva-line-item';
