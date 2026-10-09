import type { LabOrder } from '../../../lib/clinical/types';
import { SAM } from './patients';

type Row = [name: string, value: number, unit: string, low: number, high: number];
const results = (rows: Row[]) => rows.map(([name, value, unit, low, high]) => ({ name, value, unit, low, high }));

/** Sam Rivera's five labs, copied from the prototype (`LABS` in app-core.jsx); the last one is still processing. */
export const LABS: LabOrder[] = [
  {
    id: 'LAB-50301', patientRef: SAM.patientRef, name: 'Complete blood count', collectedAt: '2026-10-03', status: 'ready', orderedByDoctorKey: 'mlv-doc-amara-okafor',
    laboratory: 'Quest Diagnostics · Midtown', note: 'All values are within the expected range. No action needed.',
    results: results([['Hemoglobin', 14.2, 'g/dL', 12, 17.5], ['White blood cells', 6.8, '×10³/µL', 4, 11], ['Platelets', 262, '×10³/µL', 150, 400], ['Hematocrit', 42, '%', 36, 52]]),
  },
  {
    id: 'LAB-50302', patientRef: SAM.patientRef, name: 'Lipid panel', collectedAt: '2026-09-24', status: 'ready', orderedByDoctorKey: 'mlv-doc-sofia-marchetti',
    laboratory: 'Quest Diagnostics · Midtown', note: 'LDL cholesterol is above the target. Your cardiologist has adjusted your atorvastatin and will recheck in 12 weeks.',
    results: results([['Total cholesterol', 221, 'mg/dL', 0, 200], ['LDL cholesterol', 148, 'mg/dL', 0, 100], ['HDL cholesterol', 52, 'mg/dL', 40, 100], ['Triglycerides', 118, 'mg/dL', 0, 150]]),
  },
  {
    id: 'LAB-50303', patientRef: SAM.patientRef, name: 'HbA1c', collectedAt: '2026-09-24', status: 'ready', orderedByDoctorKey: 'mlv-doc-sofia-marchetti',
    laboratory: 'Quest Diagnostics · Midtown', note: 'Blood sugar control is in the normal range.',
    results: results([['HbA1c', 5.4, '%', 4, 5.7], ['Estimated average glucose', 108, 'mg/dL', 70, 117]]),
  },
  {
    id: 'LAB-50304', patientRef: SAM.patientRef, name: 'Vitamin D (25-OH)', collectedAt: '2026-08-12', status: 'ready', orderedByDoctorKey: 'mlv-doc-amara-okafor',
    laboratory: 'Labcorp · Chelsea', note: 'Level is low. Consider a daily supplement of 2,000 IU and retest in 3 months.',
    results: results([['25-OH Vitamin D', 19, 'ng/mL', 30, 100]]),
  },
  {
    id: 'LAB-50305', patientRef: SAM.patientRef, name: 'Thyroid panel (TSH)', collectedAt: '2026-10-06', status: 'processing', orderedByDoctorKey: 'mlv-doc-amara-okafor',
    laboratory: 'Labcorp · Chelsea', note: 'Your sample was received. Results usually arrive within 48 hours.', results: [],
  },
];
