import type { Prescription } from '../../../lib/clinical/types';
import { MEDICATIONS, medSku } from './medications';
import { ALEX, JORDAN, SAM } from './patients';

const sku = (slug: string) => {
  const m = MEDICATIONS.find((x) => x.slug === slug);
  if (!m) throw new Error(`unknown medication ${slug}`);
  return medSku(m);
};

/** Sam's two prescriptions copy the prototype (`RX` in app-core.jsx): RX-48213 has 0 refills left (the "cannot dispense" case), RX-77102 has 3. */
export const PRESCRIPTIONS: Prescription[] = [
  {
    number: 'RX-48213', patientRef: SAM.patientRef, prescriber: 'Dr. Amara Okafor', issuedAt: '2026-10-02', refillsLeft: 0,
    lines: [
      { lineRef: 'RX-48213-1', sku: sku('amoxicillin-500-mg'), name: 'Amoxicillin 500 mg capsules', sig: '1 capsule, 3× daily for 7 days', qty: 21 },
      { lineRef: 'RX-48213-2', sku: sku('ibuprofen-400-mg'), name: 'Ibuprofen 400 mg tablets', sig: '1 tablet every 8 h as needed, with food', qty: 20 },
      { lineRef: 'RX-48213-3', sku: sku('cetirizine-10-mg'), name: 'Cetirizine 10 mg tablets', sig: '1 tablet daily', qty: 30 },
    ],
  },
  {
    number: 'RX-77102', patientRef: SAM.patientRef, prescriber: 'Dr. Sofia Marchetti', issuedAt: '2026-09-24', refillsLeft: 3,
    lines: [
      { lineRef: 'RX-77102-1', sku: sku('atorvastatin-20-mg'), name: 'Atorvastatin 20 mg tablets', sig: '1 tablet nightly', qty: 30 },
      { lineRef: 'RX-77102-2', sku: sku('lisinopril-10-mg'), name: 'Lisinopril 10 mg tablets', sig: '1 tablet each morning', qty: 30 },
    ],
  },
  // Jordan Lee: one prescription that can be dispensed and one that has expired
  {
    number: 'RX-55120', patientRef: JORDAN.patientRef, prescriber: 'Dr. Tomás Alvarez', issuedAt: '2026-09-15', expiresAt: '2027-09-15', refillsLeft: 2,
    lines: [{ lineRef: 'RX-55120-1', sku: sku('amlodipine-5-mg'), name: 'Amlodipine 5 mg tablets', sig: '1 tablet daily', qty: 30 }],
  },
  {
    number: 'RX-31877', patientRef: JORDAN.patientRef, prescriber: 'Dr. Priya Nair', issuedAt: '2025-09-01', expiresAt: '2026-03-01', refillsLeft: 1,
    lines: [{ lineRef: 'RX-31877-1', sku: sku('sertraline-50-mg'), name: 'Sertraline 50 mg tablets', sig: '1 tablet each morning', qty: 30 }],
  },
  // Credentialed purchase scope demo: the same controlled class (schedule IV) for three patients. Sam holds
  // a valid credential (purchasable), Jordan's is awaiting verification (pending), Alex has none (credential required).
  {
    number: 'RX-61044', patientRef: SAM.patientRef, prescriber: 'Dr. Sofia Marchetti', issuedAt: '2026-10-05', expiresAt: '2027-10-05', refillsLeft: 2,
    lines: [{ lineRef: 'RX-61044-1', sku: sku('tramadol-50-mg'), name: 'Tramadol 50 mg tablets', sig: '1 tablet every 12 h as needed for pain', qty: 30 }],
  },
  {
    number: 'RX-42017', patientRef: ALEX.patientRef, prescriber: 'Dr. Priya Nair', issuedAt: '2026-10-03', expiresAt: '2027-10-03', refillsLeft: 2,
    lines: [{ lineRef: 'RX-42017-1', sku: sku('alprazolam-0-5-mg'), name: 'Alprazolam 0.5 mg tablets', sig: '1 tablet at night as needed', qty: 30 }],
  },
  {
    number: 'RX-58833', patientRef: JORDAN.patientRef, prescriber: 'Dr. Tomás Alvarez', issuedAt: '2026-10-04', expiresAt: '2027-10-04', refillsLeft: 1,
    lines: [{ lineRef: 'RX-58833-1', sku: sku('tramadol-50-mg'), name: 'Tramadol 50 mg tablets', sig: '1 tablet every 12 h as needed for pain', qty: 30 }],
  },
];
