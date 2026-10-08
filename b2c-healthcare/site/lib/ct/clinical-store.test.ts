import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { credentialSource, labSource, prescriptionSource } from '@/lib/ct/clinical-store';
import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';

const rx = (number: string, patientRef: string, issuedAt: string) => ({ number, patientRef, prescriber: 'Dr. Test', issuedAt, refillsLeft: 1, lines: [] });

describe('clinical-store (Custom Object stand-in)', () => {
  beforeEach(() => {
    fake = createFakeObjects();
  });

  it('lists prescriptions only for the given patientRef, newest first', async () => {
    await putObject(CONTAINERS.rx, 'RX-1', rx('RX-1', 'pt_a', '2026-01-01'));
    await putObject(CONTAINERS.rx, 'RX-2', rx('RX-2', 'pt_a', '2026-03-01'));
    await putObject(CONTAINERS.rx, 'RX-3', rx('RX-3', 'pt_b', '2026-02-01'));
    expect((await prescriptionSource.listForPatient('pt_a')).map((r) => r.number)).toEqual(['RX-2', 'RX-1']);
    expect(await prescriptionSource.listForPatient('pt_none')).toEqual([]);
  });

  it('getByNumber returns null for an unknown number', async () => {
    expect(await prescriptionSource.getByNumber('RX-0')).toBeNull();
    await putObject(CONTAINERS.rx, 'RX-1', rx('RX-1', 'pt_a', '2026-01-01'));
    expect((await prescriptionSource.getByNumber('RX-1'))?.patientRef).toBe('pt_a');
  });

  it('labs: list by patient, newest first, and get by id', async () => {
    const lab = (id: string, patientRef: string, collectedAt: string) => ({ id, patientRef, name: 'x', collectedAt, status: 'ready', orderedByDoctorKey: 'k', laboratory: 'L', note: '', results: [] });
    await putObject(CONTAINERS.lab, 'L1', lab('L1', 'pt_a', '2026-01-01'));
    await putObject(CONTAINERS.lab, 'L2', lab('L2', 'pt_a', '2026-02-01'));
    expect((await labSource.listForPatient('pt_a')).map((l) => l.id)).toEqual(['L2', 'L1']);
    expect((await labSource.getById('L1'))?.id).toBe('L1');
    expect(await labSource.getById('nope')).toBeNull();
  });

  it('credentials are keyed by patientRef and class', async () => {
    const c = { patientRef: 'pt_a', class: 'schedule-iv', issuer: 'Demo', validFrom: '2026-01-01', validTo: '2027-01-01', status: 'active' };
    await putObject(CONTAINERS.credential, 'pt_a.schedule-iv', c);
    expect(await credentialSource.get('pt_a', 'schedule-iv')).toMatchObject({ status: 'active' });
    expect(await credentialSource.get('pt_a', 'other')).toBeNull();
    expect(await credentialSource.listForPatient('pt_a')).toHaveLength(1);
  });

  it('a patientRef with predicate characters cannot widen the query', async () => {
    await putObject(CONTAINERS.rx, 'RX-1', rx('RX-1', 'pt_a', '2026-01-01'));
    expect(await prescriptionSource.listForPatient('pt_a" or patientRef="pt_a')).toEqual([]);
  });
});
