import 'server-only';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { getBookingByReference } from '@/lib/ct/bookings';
import { CONTAINERS, getObject, putObject, queryObjects, statusOf } from '@/lib/ct/custom-objects';
import type { Booking } from '@/lib/clinical/types';

/** Health data rule: nothing here logs or returns a booking detail; only a count leaves this module. */

const SIMPLE_EMAIL = /^[^@\s"\\]+@[^@\s"\\]+$/;
const sameEmail = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const isLive = (b: Booking, now: Date): boolean => !b.expiresAt || Date.parse(b.expiresAt) >= now.getTime();

/** The booking as a patient booking: `patientRef` set, the guest block removed (its phone becomes the contact phone), expiry cleared. */
function asPatientBooking(booking: Booking, patientRef: string): Booking {
  const next: Booking = { ...booking, patientRef, ...(booking.guest?.phone ? { phone: booking.guest.phone } : {}) };
  delete next.guest;
  delete next.expiresAt;
  return next;
}

/**
 * After sign-in or registration: attaches guest bookings to the patient.
 *  - bookings whose reference is in the browser's signed `malva_bk` cookie (`cookieRefs`: this browser made them), and
 *  - guest bookings whose email equals `verifiedEmail`. Pass `null` when the account's email is NOT verified: then only
 *    the cookie path applies, because an unverified address proves nothing about who owns a booking.
 * Other guests' bookings are untouched. A booking that already belongs to a patient, or changes while attaching
 * (409), is skipped. Returns how many bookings were attached.
 */
export async function attachGuestBookings(
  customerId: string,
  verifiedEmail: string | null,
  cookieRefs: readonly string[],
  now: Date = new Date(),
): Promise<number> {
  const patient = await getBookingPatient(customerId);
  if (!patient?.patientRef) return 0;

  const candidates = new Map<string, Booking>();
  for (const ref of new Set(cookieRefs)) {
    const booking = await getBookingByReference(ref, now);
    if (booking) candidates.set(booking.reference, booking);
  }
  if (verifiedEmail && SIMPLE_EMAIL.test(verifiedEmail)) {
    const variants = [...new Set([verifiedEmail.trim(), verifiedEmail.trim().toLowerCase()])];
    // The platform compares case-sensitively, so a guest who typed another case is only found through the cookie path.
    const where = `value(guest(email in (${variants.map((e) => `"${e}"`).join(', ')})))`;
    for (const stored of await queryObjects<Booking>(CONTAINERS.booking, where)) {
      const b = stored.value;
      if (b.guest && sameEmail(b.guest.email, verifiedEmail) && isLive(b, now)) candidates.set(b.reference, b);
    }
  }

  let attached = 0;
  for (const booking of candidates.values()) {
    if (booking.patientRef || !booking.guest) continue;
    const stored = await getObject<Booking>(CONTAINERS.booking, booking.reference);
    if (!stored || stored.value.patientRef || !stored.value.guest) continue;
    try {
      await putObject(CONTAINERS.booking, booking.reference, asPatientBooking(stored.value, patient.patientRef), stored.version);
      attached += 1;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  return attached;
}
