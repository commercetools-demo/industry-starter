import type { Prescription } from '@/lib/clinical/types';
import type { Medication } from '@/lib/types';

/** Synthetic prescriptions and catalog rows for the prescription tests. */
export const SAM_REF = 'pt_sam';
export const ALEX_REF = 'pt_alex';

export const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

export const RX_48213: Prescription = {
  number: 'RX-48213',
  patientRef: SAM_REF,
  prescriber: 'Dr. Amara Okafor',
  issuedAt: '2026-10-02',
  refillsLeft: 0,
  lines: [
    { lineRef: 'RX-48213-1', sku: 'MED-amox', name: 'Amoxicillin 500 mg capsules', sig: '1 capsule, 3x daily for 7 days', qty: 21 },
    { lineRef: 'RX-48213-2', sku: 'MED-ibu', name: 'Ibuprofen 400 mg tablets', sig: '1 tablet every 8 h', qty: 20 },
  ],
};

export const RX_77102: Prescription = {
  number: 'RX-77102',
  patientRef: SAM_REF,
  prescriber: 'Dr. Sofia Marchetti',
  issuedAt: '2026-09-24',
  refillsLeft: 3,
  lines: [
    { lineRef: 'RX-77102-1', sku: 'MED-ator', name: 'Atorvastatin 20 mg tablets', sig: '1 tablet nightly', qty: 30 },
    { lineRef: 'RX-77102-2', sku: 'MED-lis', name: 'Lisinopril 10 mg tablets', sig: '1 tablet each morning', qty: 30 },
  ],
};

export const RX_EXPIRED: Prescription = {
  number: 'RX-31877',
  patientRef: SAM_REF,
  prescriber: 'Dr. Priya Nair',
  issuedAt: '2025-09-01',
  expiresAt: '2026-03-01',
  refillsLeft: 0,
  lines: [{ lineRef: 'RX-31877-1', sku: 'MED-ser', name: 'Sertraline 50 mg tablets', sig: '1 tablet each morning', qty: 30 }],
};

export const RX_ALEX: Prescription = {
  number: 'RX-90001',
  patientRef: ALEX_REF,
  prescriber: 'Dr. Tomas Alvarez',
  issuedAt: '2026-09-30',
  refillsLeft: 2,
  lines: [{ lineRef: 'RX-90001-1', sku: 'MED-aml', name: 'Amlodipine 5 mg tablets', sig: '1 tablet daily', qty: 30 }],
};

export const ALL_RX = [RX_48213, RX_77102, RX_EXPIRED, RX_ALEX];

const med = (sku: string, name: string, cents: number, maxQtyPerOrder: number | null, minDays = 90): Medication => ({
  id: sku,
  key: sku,
  slug: sku.toLowerCase(),
  name,
  description: '',
  sku,
  strength: '',
  dosageForm: 'Tablet',
  rxOnly: true,
  dispenseUnit: 'pack',
  minRemainingShelfLifeDays: minDays,
  maxQtyPerOrder,
  hsaEligible: true,
  controlClass: null,
  price: usd(cents),
  imageUrl: null,
  categoryIds: [],
});

export const CATALOG: Record<string, Medication> = {
  'MED-amox': med('MED-amox', 'Amoxicillin', 1450, 2),
  'MED-ibu': med('MED-ibu', 'Ibuprofen', 620, 5),
  'MED-ator': med('MED-ator', 'Atorvastatin', 1875, 3),
  'MED-lis': med('MED-lis', 'Lisinopril', 1140, 3),
  'MED-ser': med('MED-ser', 'Sertraline', 1420, 2),
  'MED-aml': med('MED-aml', 'Amlodipine', 1050, 3),
};
