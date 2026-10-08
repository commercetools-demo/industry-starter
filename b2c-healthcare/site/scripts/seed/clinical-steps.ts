import { BOOKINGS } from './data/bookings';
import { CREDENTIALS, credentialObjectKey } from './data/credentials';
import { LABS } from './data/labs';
import { PATIENTS, patientDraft } from './data/patients';
import { PRESCRIPTIONS } from './data/prescriptions';
import { REVIEWS, reviewDraft } from './data/reviews';
import { SCHEDULES } from './data/schedules';
import { ensureObject } from './custom-objects';
import { ensureKeyed, pickDiff, type Ctx, type Step } from './lib';

/** Containers written by the storefront (workstream F) and seeded here. */
export const CONTAINERS = {
  schedule: 'malva-schedule',
  rx: 'malva-rx',
  lab: 'malva-lab',
  credential: 'malva-credential',
  booking: 'malva-booking',
} as const;

/** Three demo patients. Needs `SEED_PATIENT_PASSWORD`; the email is created verified, with one default address. */
export function patientSteps(ctx: Ctx, password: string): Step[] {
  return PATIENTS.map((p) => ({
    name: `customer ${p.email}`,
    run: () => ensureKeyed(ctx, 'customers', patientDraft(p, password), (e, d) => pickDiff(e, d, ['email', 'firstName', 'lastName'])),
  }));
}

/** Verified reviews on the doctor products (so the products' rating statistics roll up). Needs the doctor products. */
export function reviewSteps(ctx: Ctx): Step[] {
  return REVIEWS.map((r) => ({ name: `review ${r.key}`, run: () => ensureKeyed(ctx, 'reviews', reviewDraft(r), (e, d) => pickDiff(e, d, ['rating', 'text', 'title'])) }));
}

/** Schedules, prescriptions, labs, credentials and Sam's past booking as Custom Objects. */
export function objectSteps(ctx: Ctx): Step[] {
  return [
    ...SCHEDULES.map((s) => ({ name: `schedule ${s.doctorKey}`, run: () => ensureObject(ctx, CONTAINERS.schedule, s.doctorKey, s.schedule) })),
    // refills change when an order dispenses, so an existing prescription is not compared
    ...PRESCRIPTIONS.map((r) => ({ name: `prescription ${r.number}`, run: () => ensureObject(ctx, CONTAINERS.rx, r.number, r, 'exists') })),
    ...LABS.map((l) => ({ name: `lab ${l.id}`, run: () => ensureObject(ctx, CONTAINERS.lab, l.id, l) })),
    ...CREDENTIALS.map((c) => ({ name: `credential ${credentialObjectKey(c)}`, run: () => ensureObject(ctx, CONTAINERS.credential, credentialObjectKey(c), c) })),
    ...BOOKINGS.map((b) => ({ name: `booking ${b.reference}`, run: () => ensureObject(ctx, CONTAINERS.booking, b.reference, b, 'exists') })),
  ];
}

export interface ClinicalOptions { patientPassword?: string }

/** Customers are skipped (and say so) when no password is available; everything else is seeded. */
export function clinicalSteps(ctx: Ctx, o: ClinicalOptions = {}): Step[] {
  const patients: Step[] = o.patientPassword
    ? patientSteps(ctx, o.patientPassword)
    : [{ name: 'customers skipped: SEED_PATIENT_PASSWORD is not set', run: async () => 'ok' as const }];
  return [...reviewSteps(ctx), ...objectSteps(ctx), ...patients];
}
