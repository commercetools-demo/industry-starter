import 'server-only';
import type { LabDetailView, LabListItem } from '@/lib/account-types';
import type { LabOrder } from '@/lib/clinical/types';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { labSource } from '@/lib/ct/clinical-store';
import { getDoctorByKey, type DoctorContext } from '@/lib/ct/doctors';
import { flagFor } from '@/lib/labs';

/** Lab reads for the account area. Health data: nothing here logs or puts a value, name or id in a URL. */

const SAFE_LAB_ID = /^[\w.-]{1,100}$/;
const DEFAULT_CONTEXT: DoctorContext = { locale: 'en-US', currency: 'USD', country: 'US' };

export function toLabListItem(lab: LabOrder): LabListItem {
  return { id: lab.id, name: lab.name, collectedAt: lab.collectedAt, laboratory: lab.laboratory, status: lab.status };
}

/** The patient reference of the signed-in customer, or null when the customer has none. */
async function patientRefOf(customerId: string): Promise<string | null> {
  return (await getBookingPatient(customerId))?.patientRef ?? null;
}

/** The patient's lab tests, newest first. */
export async function listLabs(customerId: string): Promise<LabListItem[]> {
  const ref = await patientRefOf(customerId);
  if (!ref) return [];
  return (await labSource.listForPatient(ref)).map(toLabListItem);
}

/** The lab order when it exists and belongs to the patient; null for an unknown and for a foreign id alike. */
export async function getOwnLab(customerId: string, id: string): Promise<LabOrder | null> {
  if (!SAFE_LAB_ID.test(id)) return null;
  const ref = await patientRefOf(customerId);
  if (!ref) return null;
  const lab = await labSource.getById(id);
  return lab && lab.patientRef === ref ? lab : null;
}

/** Display name of the ordering doctor; empty when the doctor cannot be resolved (the page then omits the link text). */
async function doctorName(key: string, ctx: DoctorContext): Promise<string> {
  try {
    return (await getDoctorByKey(key, ctx, { reviews: false }))?.name ?? '';
  } catch {
    return '';
  }
}

/** Detail view of one of the patient's labs, or null (same for unknown and foreign). A processing test carries no results. */
export async function getLabDetail(customerId: string, id: string, ctx: DoctorContext = DEFAULT_CONTEXT): Promise<LabDetailView | null> {
  const lab = await getOwnLab(customerId, id);
  if (!lab) return null;
  return {
    ...toLabListItem(lab),
    note: lab.note,
    orderedByDoctorKey: lab.orderedByDoctorKey,
    orderedByName: await doctorName(lab.orderedByDoctorKey, ctx),
    results: lab.status === 'ready' ? lab.results.map((r) => ({ ...r, flag: flagFor(r.value, r.low, r.high) })) : [],
  };
}
