import 'server-only';
import { readGuestBookingRefs } from '@/lib/booking-access';
import { attachGuestBookings } from '@/lib/ct/bookings-attach';
import { log } from '@/lib/log';

export interface SignedInCustomer {
  customerId: string;
  email: string;
  /** Only a verified address may attach bookings by email match. */
  emailVerified: boolean;
}

/**
 * Hook for the sign-in and registration routes (R-07): attaches the visitor's guest bookings (cookie references and,
 * for a verified account, bookings with the account's email) to the patient. Never throws and never delays or fails a
 * sign-in: a problem is logged by class only and the bookings stay as they were.
 */
export async function attachAfterSignIn(user: SignedInCustomer): Promise<void> {
  try {
    const refs = await readGuestBookingRefs().catch(() => []);
    await attachGuestBookings(user.customerId, user.emailVerified ? user.email : null, refs);
  } catch (error) {
    log.warn('attach-bookings', 'could not attach guest bookings', error);
  }
}
