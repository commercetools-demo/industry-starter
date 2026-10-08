import 'server-only';
import { ApiError } from '@/lib/api';
import type { RxContext } from '@/lib/ct/prescriptions';
import { getPatient, type Patient } from '@/lib/ct/patient';
import type { SessionData } from '@/lib/session';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

/** Shared by the prescription Route Handlers and the page: region defaults from the session, and the patient. */
export function rxContextOf(session: SessionData): RxContext {
  const locale = session.locale && isSupportedLocale(session.locale) ? session.locale : DEFAULT_LOCALE;
  const region = COUNTRY_CONFIG[locale];
  return { locale, currency: session.currency ?? region.currency, country: session.country ?? region.country };
}

/** The signed-in customer's patient record, or a 403 when the account has no `patientRef` (no clinical data is reachable). */
export async function requirePatient(customerId: string): Promise<Patient> {
  const patient = await getPatient(customerId);
  if (!patient) throw new ApiError(403, 'You do not have access to this.');
  return patient;
}

export const NO_STORE = { 'cache-control': 'no-store' } as const;
