import 'server-only';
import { cookies } from 'next/headers';
import {
  addBookingRef,
  BOOKING_COOKIE,
  bookingCookieOptions,
  signBookingRefs,
  verifyBookingRefs,
} from '@/lib/booking-access-core';
import { getBookingByReference, getBookingForSession, type Booking } from '@/lib/ct/bookings';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { getSession } from '@/lib/session';
import { resolveSecret } from '@/lib/session-core';

// Same signing secret as the session, resolved lazily so `next build` can import this module with an empty environment.
const resolveSessionSecret = (): string => resolveSecret(process.env.SESSION_SECRET, process.env.NODE_ENV);

/** References of the bookings this browser created as a guest. */
export async function readGuestBookingRefs(): Promise<string[]> {
  const store = await cookies();
  return verifyBookingRefs(store.get(BOOKING_COOKIE)?.value, resolveSessionSecret());
}

/** Remembers a guest booking in this browser (Route Handlers and Server Actions only: it writes the cookie). */
export async function grantGuestBookingAccess(reference: string): Promise<void> {
  const refs = addBookingRef(await readGuestBookingRefs(), reference);
  const store = await cookies();
  store.set(BOOKING_COOKIE, await signBookingRefs(refs, resolveSessionSecret()), bookingCookieOptions(process.env.NODE_ENV));
}

/**
 * The booking for the current visitor, or null. Access rule (design-pdp): the signed-in patient who owns it, or the
 * browser that created it as a guest (signed cookie). An unknown reference and someone else's booking give the same
 * null, so nothing tells them apart.
 */
export async function getBookingForVisitor(reference: string, now: Date = new Date()): Promise<Booking | null> {
  const session = await getSession();
  if (session.customerId) {
    const patient = await getBookingPatient(session.customerId).catch(() => null);
    if (patient?.patientRef) {
      const own = await getBookingForSession(reference, { patientRef: patient.patientRef }, now);
      if (own) return own;
    }
  }
  const guestRefs = await readGuestBookingRefs();
  if (!guestRefs.includes(reference)) return null;
  const booking = await getBookingByReference(reference, now);
  // the cookie is only valid for guest bookings; a patient booking is never opened by it
  return booking && !booking.patientRef ? booking : null;
}
