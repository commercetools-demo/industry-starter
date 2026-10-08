import 'server-only';
import { apiRoot } from '@/lib/ct/client';

/** What booking needs from the signed-in customer: the opaque patient reference, and name and email for the greeting. */
export interface BookingPatient {
  /** `pt_<random>` from `custom.fields.patientRef`; undefined for a customer that has none. */
  patientRef?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

/** One customer for a booking; null when it no longer exists. Per patient, so never cached. */
export async function getBookingPatient(customerId: string): Promise<BookingPatient | null> {
  try {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    const ref = (body.custom?.fields as { patientRef?: unknown } | undefined)?.patientRef;
    return {
      ...(typeof ref === 'string' && ref ? { patientRef: ref } : {}),
      ...(body.firstName ? { firstName: body.firstName } : {}),
      ...(body.lastName ? { lastName: body.lastName } : {}),
      email: body.email,
    };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}
