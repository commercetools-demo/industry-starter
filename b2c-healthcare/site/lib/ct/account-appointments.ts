import 'server-only';
import type { AppointmentView, AppointmentsView } from '@/lib/account-types';
import type { Booking } from '@/lib/clinical/types';
import { MIN_LEAD_MS } from '@/lib/clinical/slots';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { listBookingsForPatient } from '@/lib/ct/bookings';
import { getDoctorByKey, type DoctorContext } from '@/lib/ct/doctors';

/** Health data rule: nothing here logs a booking, its reason or the doctor. */

const DEFAULT_CONTEXT: DoctorContext = { locale: 'en-US', currency: 'USD', country: 'US' };
/** Used only when a doctor cannot be resolved; the clinic zone of the demo. */
const FALLBACK_ZONE = 'America/New_York';

interface DoctorInfo { name: string; clinicName: string; timezone: string }

async function doctorInfo(key: string, ctx: DoctorContext): Promise<DoctorInfo> {
  try {
    const d = await getDoctorByKey(key, ctx, { reviews: false });
    if (d) return { name: d.name, clinicName: d.clinicName, timezone: d.timezone || FALLBACK_ZONE };
  } catch {
    // the doctor cannot be read right now: the card still shows date, time and reference
  }
  return { name: '', clinicName: '', timezone: FALLBACK_ZONE };
}

function toView(b: Booking, info: DoctorInfo, now: Date): AppointmentView {
  return {
    reference: b.reference,
    doctorKey: b.doctorKey,
    doctorName: info.name,
    mode: b.mode,
    clinicName: info.clinicName,
    startsAt: b.startsAt,
    timezone: info.timezone,
    status: b.status,
    canCancel: b.status === 'booked' && Date.parse(b.startsAt) - now.getTime() >= MIN_LEAD_MS,
  };
}

/** The patient's bookings: upcoming (still booked, soonest first) and past (everything else, most recent first). */
export async function listAppointments(customerId: string, now: Date = new Date(), ctx: DoctorContext = DEFAULT_CONTEXT): Promise<AppointmentsView> {
  const patient = await getBookingPatient(customerId);
  if (!patient?.patientRef) return { upcoming: [], past: [] };
  const bookings = await listBookingsForPatient(patient.patientRef);
  const keys = [...new Set(bookings.map((b) => b.doctorKey))];
  const infos = new Map(await Promise.all(keys.map(async (k) => [k, await doctorInfo(k, ctx)] as const)));
  const views = bookings.map((b) => toView(b, infos.get(b.doctorKey) as DoctorInfo, now));
  const isUpcoming = (v: AppointmentView) => v.status === 'booked' && Date.parse(v.startsAt) >= now.getTime();
  return {
    upcoming: views.filter(isUpcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: views.filter((v) => !isUpcoming(v)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}
