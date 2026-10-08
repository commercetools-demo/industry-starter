import type { Booking } from '@/lib/clinical/types';
import type { BookingView, DoctorProfile } from '@/lib/types';

/** First word of a full name ("Gina Guest" -> "Gina"); empty when there is none. */
export function firstNameOf(fullName: string | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * What the confirmation page needs, and nothing more: the stored booking also holds the reason, the phone and the
 * guest's email, which the page never shows (health-data-minimization). `patientFirstName` comes from the account for
 * a signed-in patient's booking; a guest's greeting is the first word of the name they gave.
 */
export function mapBookingView(booking: Booking, doctor: Pick<DoctorProfile, 'name' | 'specialty' | 'clinicName' | 'timezone' | 'fees'> | null, patientFirstName?: string): BookingView {
  return {
    reference: booking.reference,
    firstName: booking.guest ? firstNameOf(booking.guest.name) : (patientFirstName ?? ''),
    doctorName: doctor?.name ?? '',
    specialty: doctor?.specialty ?? '',
    clinicName: doctor?.clinicName ?? '',
    mode: booking.mode,
    startsAt: booking.startsAt,
    timezone: doctor?.timezone || 'UTC',
    fee: doctor?.fees[booking.mode] ?? null,
    guest: !booking.patientRef,
  };
}
