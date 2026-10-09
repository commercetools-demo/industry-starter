/**
 * Single source for the privacy scripts (workstream X, D-025): which Custom Object containers exist, how each one links to a
 * person, and what the erase, subject-access and retention scripts do with them. `inventory.test.ts` fails when
 * `lib/ct/custom-objects.ts` gets a container that is not listed here or in `docs/privacy-inventory.md`.
 */

/** How the objects of a container are found for one patient. */
export type SubjectLink =
  /** `value(patientRef="...")`. */
  | 'patientRef'
  /** Bookings: `patientRef` for patients, `guest.email` for guests. */
  | 'patientRef-or-guest-email'
  /** Key is `rl-<customerId>`. */
  | 'key-customer-id'
  /** `value(recurringOrderId in (...))`: the customer's recurring orders. */
  | 'recurring-order-id'
  /** Key starts with the id of one of the customer's carts. */
  | 'key-cart-id'
  /** Holds no person and nothing a person can be resolved from (schedule, counter) or only a pseudonymous request id (slot claim). */
  | 'none';

export interface ContainerInfo {
  container: string;
  link: SubjectLink;
  /** True when the objects can hold personal or health data, or an identifier that resolves to a person. */
  personal: boolean;
  what: string;
  retention: string;
}

export const CONTAINER_INVENTORY: readonly ContainerInfo[] = [
  { container: 'malva-rx', link: 'patientRef', personal: true, what: 'Prescriptions (demo stand-in for an EHR): sig, prescriber, refills', retention: 'Owned by the clinical system; deleted on erasure' },
  { container: 'malva-lab', link: 'patientRef', personal: true, what: 'Lab orders and results', retention: 'Owned by the clinical system; deleted on erasure' },
  { container: 'malva-credential', link: 'patientRef', personal: true, what: 'Credential (purchase scope) of a patient', retention: 'Until validTo; deleted on erasure' },
  { container: 'malva-booking', link: 'patientRef-or-guest-email', personal: true, what: 'Appointment: reason text, phone, guest name/email/phone', retention: 'Guest: removed 90 days after the visit (expiresAt); cancelled patient booking: reason and phone removed 90 days after the visit' },
  { container: 'malva-slot-claim', link: 'none', personal: false, what: 'One claim per booked slot (doctor, mode, time, request id)', retention: 'Deleted with the booking; stale claims removed by retention' },
  { container: 'malva-schedule', link: 'none', personal: false, what: 'Doctor weekly pattern', retention: 'Not personal; kept' },
  { container: 'malva-counter', link: 'none', personal: false, what: 'Order number counter', retention: 'Not personal; kept' },
  { container: 'malva-ratelimit', link: 'key-customer-id', personal: true, what: 'Failed lookup timestamps per customer id (rl-<customerId>) and per hashed login email (rl-login-<hash>)', retention: 'Removed by retention when no failure is inside the window' },
  { container: 'malva-dispense-ledger', link: 'patientRef', personal: true, what: 'Per order: patientRef, rx number, line ref, sku, quantities', retention: 'Deleted on erasure' },
  { container: 'malva-order-attempt', link: 'key-cart-id', personal: false, what: 'Checkout double-submit lock (cart id + version, order id and number)', retention: 'Removed by retention 30 days after the attempt; deleted on erasure with the cart' },
  { container: 'malva-refill-log', link: 'recurring-order-id', personal: true, what: 'Auto-refill gate decisions per recurring order (ids, dates, reason code)', retention: 'Removed by retention after 180 days; deleted on erasure' },
  { container: 'malva-allowance', link: 'patientRef', personal: true, what: 'Benefit allowance cycle per member (cents, order ids)', retention: 'Deleted on erasure' },
  { container: 'malva-allowance-ledger', link: 'patientRef', personal: true, what: 'Per order that drew from an allowance: patientRef, cycle, amount', retention: 'Deleted on erasure' },
];

export const PRIVACY_CONTAINERS: readonly string[] = CONTAINER_INVENTORY.map((c) => c.container);

/** Retention constants shared by `retention.ts` and the docs. */
export const RETENTION = {
  guestBookingDays: 90,
  cancelledBookingDays: 90,
  slotClaimStaleDays: 1,
  orderAttemptDays: 30,
  refillLogDays: 180,
  rateLimitWindowMs: 10 * 60 * 1000,
} as const;
