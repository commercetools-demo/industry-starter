import { BOOKINGS } from './data/bookings';
import { CREDENTIALS } from './data/credentials';
import { DOCTORS, doctorKey } from './data/doctors';
import { LABS } from './data/labs';
import { PATIENTS, SAM, patientKey } from './data/patients';
import { PRESCRIPTIONS } from './data/prescriptions';
import { REVIEWS } from './data/reviews';
import { SCHEDULES } from './data/schedules';
import { listObjects, stable } from './custom-objects';
import { listAll, type Rec, type Root } from './lib';
import type { Credential, LabOrder, Prescription } from '../../lib/clinical/types';

type Check = (name: string, ok: boolean, detail?: string) => void;

const sameSet = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

interface Variant { sku?: string }

/** Read-only checks of the clinical stand-in (F-07): containers and counts, cross references, Sam's prescriptions, patients and reviews. */
export async function verifyClinical(root: Root, check: Check): Promise<void> {
  const [schedules, rx, labs, credentials, bookings] = await Promise.all(['malva-schedule', 'malva-rx', 'malva-lab', 'malva-credential', 'malva-booking'].map((c) => listObjects(root, c)));

  check(`malva-schedule holds one schedule per doctor (${DOCTORS.length})`, sameSet(schedules.map((o) => o.key), SCHEDULES.map((s) => s.doctorKey)), `found ${schedules.map((o) => o.key).join(', ')}`);
  check(`malva-rx holds ${PRESCRIPTIONS.length} prescriptions`, sameSet(rx.map((o) => o.key), PRESCRIPTIONS.map((r) => r.number)), `found ${rx.map((o) => o.key).join(', ')}`);
  check(`malva-lab holds ${LABS.length} labs`, sameSet(labs.map((o) => o.key), LABS.map((l) => l.id)), `found ${labs.map((o) => o.key).join(', ')}`);
  check(`malva-credential holds ${CREDENTIALS.length} credential`, credentials.length === CREDENTIALS.length, `found ${credentials.length}`);
  check('malva-booking holds the seeded past booking', BOOKINGS.every((b) => bookings.some((o) => o.key === b.reference)));

  const wrongSchedules = SCHEDULES.filter((s) => {
    const have = schedules.find((o) => o.key === s.doctorKey);
    return !have || stable(have.value) !== stable(s.schedule);
  });
  check('schedules match the seed data (zone, weekly pattern)', wrongSchedules.length === 0, wrongSchedules.map((s) => s.doctorKey).join(', '));

  // cross references
  const products = await listAll(root, 'products');
  const productKeys = new Set(products.map((p) => p.key as string));
  const skus = new Set(products.flatMap((p) => {
    const md = p.masterData as { current?: { masterVariant: Variant; variants?: Variant[] }; staged?: { masterVariant: Variant; variants?: Variant[] } };
    const data = md.current ?? md.staged;
    return [data?.masterVariant, ...(data?.variants ?? [])].map((v) => v?.sku).filter((s): s is string => !!s);
  }));
  const badLabs = (labs.map((o) => o.value) as LabOrder[]).filter((l) => !productKeys.has(l.orderedByDoctorKey));
  check('every lab orderedByDoctorKey exists as a product', badLabs.length === 0, badLabs.map((l) => l.id).join(', '));
  const missingSkus = (rx.map((o) => o.value) as Prescription[]).flatMap((r) => r.lines.filter((l) => !skus.has(l.sku)).map((l) => `${r.number}:${l.sku}`));
  check('every RX line SKU exists as a product variant', missingSkus.length === 0, missingSkus.join(', '));

  // Sam's prescriptions match the prototype
  const samRx = (rx.map((o) => o.value) as Prescription[]).filter((r) => r.patientRef === SAM.patientRef).sort((a, b) => a.number.localeCompare(b.number));
  const wanted = PRESCRIPTIONS.filter((r) => r.patientRef === SAM.patientRef).sort((a, b) => a.number.localeCompare(b.number));
  const shape = (r: Prescription) => stable({ number: r.number, prescriber: r.prescriber, issuedAt: r.issuedAt, lines: r.lines.map((l) => [l.name, l.sig, l.qty]) });
  check('Sam Rivera has RX-48213 and RX-77102 as in the prototype', samRx.length === wanted.length && samRx.every((r, i) => shape(r) === shape(wanted[i])));
  const left = (n: string) => samRx.find((r) => r.number === n)?.refillsLeft;
  check('RX-48213 has 0 refills left; RX-77102 has at most 3 (fewer once an order has dispensed it)', left('RX-48213') === 0 && left('RX-77102') !== undefined && (left('RX-77102') as number) >= 0 && (left('RX-77102') as number) <= 3);
  check('Sam has five labs and the controlled-class credential', (labs.map((o) => o.value) as LabOrder[]).filter((l) => l.patientRef === SAM.patientRef).length === 5 && (credentials.map((o) => o.value) as Credential[]).some((c) => c.patientRef === SAM.patientRef && c.status === 'active'));

  // patients: exactly three example.com customers with verified email, an address and a patientRef
  const customers = (await listAll(root, 'customers')).filter((c) => typeof c.key === 'string' && (c.key as string).startsWith('mlv-patient-'));
  const emails = customers.map((c) => c.email as string);
  check('exactly three example.com patients', emails.length === 3 && emails.every((e) => e.endsWith('@example.com')) && sameSet(emails, PATIENTS.map((p) => p.email)), `found ${emails.join(', ')}`);
  const badPatients = PATIENTS.filter((p) => {
    const c = customers.find((x) => x.key === patientKey(p)) as Rec | undefined;
    const fields = (c?.custom as { fields?: Rec } | undefined)?.fields;
    return !c || c.isEmailVerified !== true || ((c.addresses as unknown[]) ?? []).length < 1 || fields?.patientRef !== p.patientRef;
  });
  check('patients have verified email, an address and the seeded patientRef', badPatients.length === 0, badPatients.map((p) => p.slug).join(', '));

  // reviews
  const reviews = await listAll(root, 'reviews');
  const prefixed = reviews.filter((r) => typeof r.key === 'string' && (r.key as string).startsWith('mlv-rev-'));
  check(`${REVIEWS.length} seeded reviews, all with verifiedPatient`, prefixed.length === REVIEWS.length && prefixed.every((r) => (r.custom as { fields?: Rec } | undefined)?.fields?.verifiedPatient === true), `found ${prefixed.length}`);
  const perDoctor = DOCTORS.filter((d) => {
    const want = REVIEWS.filter((r) => r.doctorKey === doctorKey(d)).length;
    const have = prefixed.filter((r) => (r.key as string).startsWith(`mlv-rev-${d.slug}-`)).length;
    return have !== want || want < 3 || want > 6;
  });
  check('3 to 6 reviews per doctor', perDoctor.length === 0, perDoctor.map((d) => d.slug).join(', '));
  const noStats = DOCTORS.filter((d) => {
    const p = products.find((x) => x.key === doctorKey(d));
    return !((p?.reviewRatingStatistics as { count?: number } | undefined)?.count ?? 0);
  });
  check('product rating statistics are non-zero for every doctor', noStats.length === 0, `${noStats.map((d) => d.slug).join(', ')} (statistics can lag a few seconds after the reviews are created)`);
}
