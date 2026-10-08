import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabOrder } from '@/lib/clinical/types';

const patient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => patient(...a) }));
const byId = vi.fn();
const list = vi.fn();
vi.mock('@/lib/ct/clinical-store', () => ({ labSource: { listForPatient: (...a: unknown[]) => list(...a), getById: (...a: unknown[]) => byId(...a) } }));
const doctor = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKey: (...a: unknown[]) => doctor(...a) }));

import { getLabDetail, getOwnLab, listLabs } from './account-labs';

const lipid: LabOrder = {
  id: 'LAB-50302', patientRef: 'pt_sam', name: 'Lipid panel', collectedAt: '2026-09-24', status: 'ready', orderedByDoctorKey: 'mlv-doc-sofia-marchetti',
  laboratory: 'Quest', note: 'LDL above target.', results: [{ name: 'LDL cholesterol', value: 148, unit: 'mg/dL', low: 0, high: 100 }, { name: 'HDL', value: 52, unit: 'mg/dL', low: 40, high: 100 }],
};
const thyroid: LabOrder = { ...lipid, id: 'LAB-50305', name: 'Thyroid panel (TSH)', status: 'processing', results: [{ name: 'TSH', value: 9, unit: 'mIU/L', low: 0.4, high: 4 }] };

beforeEach(() => {
  patient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', email: 's@example.com' });
  byId.mockReset().mockImplementation(async (id: string) => ({ 'LAB-50302': lipid, 'LAB-50305': thyroid })[id] ?? null);
  list.mockReset().mockResolvedValue([lipid]);
  doctor.mockReset().mockResolvedValue({ name: 'Dr. Sofia Marchetti' });
});

describe('design-account-area: lab reads', () => {
  it('Result table: each result carries its flag (High and Normal here)', async () => {
    const detail = await getLabDetail('c1', 'LAB-50302');
    expect(detail?.orderedByName).toBe('Dr. Sofia Marchetti');
    expect(detail?.results.map((r) => [r.name, r.flag])).toEqual([['LDL cholesterol', 'high'], ['HDL', 'normal']]);
  });

  it('Processing test: no results are returned even if the source holds some', async () => {
    expect((await getLabDetail('c1', 'LAB-50305'))?.results).toEqual([]);
  });

  it('Cross-patient access: another patient\'s lab and an unknown id both give null', async () => {
    patient.mockResolvedValue({ patientRef: 'pt_alex', email: 'a@example.com' });
    expect(await getOwnLab('c2', 'LAB-50302')).toBeNull();
    expect(await getOwnLab('c2', 'l999')).toBeNull();
  });

  it('an id that cannot be a key is refused without touching the store', async () => {
    expect(await getOwnLab('c1', '../x')).toBeNull();
    expect(byId).not.toHaveBeenCalled();
  });

  it('a customer without a patient reference sees nothing', async () => {
    patient.mockResolvedValue({ email: 'x@example.com' });
    expect(await listLabs('c1')).toEqual([]);
    expect(await getOwnLab('c1', 'LAB-50302')).toBeNull();
  });

  it('the list carries no values', async () => {
    expect(JSON.stringify(await listLabs('c1'))).not.toContain('148');
  });

  it('an unresolvable doctor leaves the name empty instead of failing the page', async () => {
    doctor.mockRejectedValue(new Error('down'));
    expect((await getLabDetail('c1', 'LAB-50302'))?.orderedByName).toBe('');
  });
});
