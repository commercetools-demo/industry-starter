import { ApiError, handle } from '@/lib/api';
import { FIELDS_INVALID, readJsonObject } from '@/lib/auth-route';
import { grantGuestBookingAccess } from '@/lib/booking-access';
import { validateBookingContact } from '@/lib/booking-validation';
import { MODES, type Mode } from '@/lib/clinical/slots';
import { BookingValidationError, createBooking, SlotUnavailableError, type Booking, type BookingInput } from '@/lib/ct/bookings';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { getDoctorByKey } from '@/lib/ct/doctors';
import { SlotTakenError } from '@/lib/ct/scheduling';
import { getSession } from '@/lib/session';
import type { BookingCreated } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

const REQUEST_ID = /^[\w-]{8,100}$/;
const DOCTOR_KEY = /^[\w-]{1,100}$/;
const SLOT_GONE = 'That time is no longer available.';

// The body of this route is health data (reason) and contact details (phone, email). Nothing in this file logs,
// echoes or formats them: errors map to fixed texts, validation answers are codes, and `handle` logs unknown
// errors through the redacting logger (class and status only).
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** An existing booking found for a replayed request id must belong to this requester and this slot, or it is not theirs. */
function belongsTo(existing: Booking, who: { patientRef?: string; guestEmail?: string }, slot: { doctorKey: string; mode: Mode; startsAt: string }): boolean {
  if (existing.doctorKey !== slot.doctorKey || existing.mode !== slot.mode || Date.parse(existing.startsAt) !== Date.parse(slot.startsAt)) return false;
  if (existing.patientRef) return !!who.patientRef && existing.patientRef === who.patientRef;
  return !!existing.guest && !!who.guestEmail && existing.guest.email.trim().toLowerCase() === who.guestEmail.trim().toLowerCase();
}

/**
 * POST /api/bookings: claims the slot and writes the booking (`createBooking`, idempotent on `requestId`).
 * A signed-in visitor books as their patient record (name and email come from the account, not the body); a guest
 * gives name, email and phone, and the browser keeps the booking in the signed `malva_bk` cookie.
 * 400 invalid fields (codes only), 404 unknown doctor, 409 the time is gone, 201 `{ reference }`.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJsonObject(request);
    const requestId = text(body.requestId);
    const doctorKey = text(body.doctorKey);
    const mode = text(body.mode);
    const startsAt = text(body.startsAt);
    if (!REQUEST_ID.test(requestId) || !DOCTOR_KEY.test(doctorKey) || !MODES.includes(mode as Mode) || Number.isNaN(Date.parse(startsAt))) {
      throw new ApiError(400, 'The request could not be processed.');
    }

    const session = await getSession();
    const patient = session.customerId ? await getBookingPatient(session.customerId) : null;
    if (patient && !patient.patientRef) throw new ApiError(403, 'You do not have access to this.');
    const guest = patient === null;

    const problems = validateBookingContact({ name: text(body.name), email: text(body.email), phone: text(body.phone), reason: text(body.reason) }, { guest });
    if (Object.keys(problems).length > 0) return Response.json({ error: FIELDS_INVALID, fields: problems }, { status: 400 });

    const locale = isSupportedLocale(session.locale) ? session.locale : DEFAULT_LOCALE;
    const region = COUNTRY_CONFIG[locale];
    const doctor = await getDoctorByKey(doctorKey, { locale, currency: session.currency ?? region.currency, country: session.country ?? region.country }, { reviews: false });
    if (!doctor) throw new ApiError(404, 'Not found.');
    if (!doctor.modes.includes(mode as Mode) || !doctor.fees[mode as Mode]) throw new ApiError(400, 'The request could not be processed.');

    const input: BookingInput = {
      requestId,
      doctorKey,
      mode: mode as Mode,
      startsAt,
      reason: text(body.reason),
      phone: text(body.phone),
      ...(patient?.patientRef ? { patientRef: patient.patientRef } : {}),
      ...(guest ? { guest: { name: text(body.name), email: text(body.email), phone: text(body.phone) } } : {}),
    };
    // a guest's phone is stored in `guest`; `phone` on the input is for patients only
    if (guest) delete input.phone;

    let result;
    try {
      result = await createBooking(input);
    } catch (error) {
      if (error instanceof SlotTakenError || error instanceof SlotUnavailableError) throw new ApiError(409, SLOT_GONE);
      if (error instanceof BookingValidationError) throw new ApiError(400, 'The request could not be processed.');
      throw error;
    }
    if (!result.created && !belongsTo(result.booking, { patientRef: patient?.patientRef, guestEmail: guest ? text(body.email) : undefined }, { doctorKey, mode: mode as Mode, startsAt })) {
      // someone replayed another visitor's request id: same answer as a taken slot, nothing about that booking
      throw new ApiError(409, SLOT_GONE);
    }
    if (guest) await grantGuestBookingAccess(result.booking.reference);
    const created: BookingCreated = { reference: result.booking.reference };
    return Response.json(created, { status: result.created ? 201 : 200 });
  });
}
