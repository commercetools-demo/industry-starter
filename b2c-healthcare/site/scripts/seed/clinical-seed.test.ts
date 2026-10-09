import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOKINGS } from './data/bookings';
import { CREDENTIALS } from './data/credentials';
import { DOCTORS, doctorKey } from './data/doctors';
import { LABS } from './data/labs';
import { MEDICATIONS, medSku } from './data/medications';
import { ALEX, JORDAN, PATIENTS, SAM } from './data/patients';
import { PRESCRIPTIONS } from './data/prescriptions';
import { REVIEWS } from './data/reviews';
import { SCHEDULES } from './data/schedules';
import { candidateSlots } from '../../lib/clinical/slots';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => ({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0 });
const PASSWORD = 'unit-test-only-password';
const seeded = async () => {
  const fake = createFakeRoot();
  const r = await runSeed(ctxOf(fake), { clinical: true, patientPassword: PASSWORD });
  return { fake, r };
};

describe('seed data files (F-06)', () => {
  it('every doctor has a schedule in their own zone and the schedules yield slots', () => {
    expect(SCHEDULES.map((s) => s.doctorKey)).toEqual(DOCTORS.map(doctorKey));
    for (const [i, s] of SCHEDULES.entries()) {
      expect(s.schedule.timezone).toBe(DOCTORS[i].timezone);
      expect(candidateSlots(s.schedule, new Date('2026-10-08T05:00:00Z')).length).toBeGreaterThan(10);
    }
  });

  it('three patients: Sam, Alex, Jordan, on example.com, with distinct opaque refs', () => {
    expect(PATIENTS.map((p) => p.firstName)).toEqual(['Sam', 'Alex', 'Jordan']);
    expect(PATIENTS.every((p) => p.email.endsWith('@example.com'))).toBe(true);
    expect(new Set(PATIENTS.map((p) => p.patientRef)).size).toBe(3);
    expect(PATIENTS.every((p) => /^pt_[a-z0-9]{8}$/.test(p.patientRef))).toBe(true);
    expect(SAM.fundingScheme).toBe('Demo Health Plan');
  });

  it('Sam\'s prototype prescriptions match; the controlled-class demo adds one each for Sam, Alex and Jordan', () => {
    const sam = PRESCRIPTIONS.filter((r) => r.patientRef === SAM.patientRef);
    expect(sam.map((r) => [r.number, r.refillsLeft, r.lines.map((l) => l.qty)])).toEqual([['RX-48213', 0, [21, 20, 30]], ['RX-77102', 3, [30, 30]], ['RX-61044', 2, [30]]]);
    expect(sam[0].lines.map((l) => l.name)).toEqual(['Amoxicillin 500 mg capsules', 'Ibuprofen 400 mg tablets', 'Cetirizine 10 mg tablets']);
    expect(PRESCRIPTIONS.filter((r) => r.patientRef === ALEX.patientRef).map((r) => r.number)).toEqual(['RX-42017']);
    const jordan = PRESCRIPTIONS.filter((r) => r.patientRef === JORDAN.patientRef);
    const now = Date.parse('2026-10-08');
    expect(jordan.map((r) => Date.parse(r.expiresAt as string) > now)).toEqual([true, false, true]);
  });

  it('every RX line SKU is a seeded medication and every lab is ordered by a seeded doctor', () => {
    const skus = new Set(MEDICATIONS.map(medSku));
    expect(PRESCRIPTIONS.flatMap((r) => r.lines).every((l) => skus.has(l.sku))).toBe(true);
    const doctors = new Set(DOCTORS.map(doctorKey));
    expect(LABS.every((l) => doctors.has(l.orderedByDoctorKey))).toBe(true);
    const names = new Set(DOCTORS.map((d) => d.name));
    expect(PRESCRIPTIONS.every((r) => names.has(r.prescriber))).toBe(true);
  });

  it('Sam has five labs (one processing), a credential (Jordan\'s is pending, Alex has none) and one past booking', () => {
    expect(LABS).toHaveLength(5);
    expect(LABS.map((l) => l.status).filter((s) => s === 'processing')).toHaveLength(1);
    expect(LABS.find((l) => l.status === 'processing')?.results).toEqual([]);
    expect(CREDENTIALS.map((c) => [c.patientRef, c.status])).toEqual([[SAM.patientRef, 'active'], [JORDAN.patientRef, 'pending']]);
    expect(BOOKINGS).toHaveLength(1);
    expect(Date.parse(BOOKINGS[0].startsAt)).toBeLessThan(Date.parse('2026-10-08'));
  });

  it('3 to 6 reviews per doctor', () => {
    for (const d of DOCTORS) {
      const n = REVIEWS.filter((r) => r.doctorKey === doctorKey(d)).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect(new Set(REVIEWS.map((r) => r.key)).size).toBe(REVIEWS.length);
  });

  it('no real-looking personal data in data/: no @gmail, emails only on example.com, phone numbers only in the 555 range', () => {
    const dir = path.resolve(__dirname, 'data');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.includes('images'))) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/@gmail|@yahoo|@hotmail|@outlook/i);
      for (const email of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) expect(email, f).toMatch(/@example\.com$/);
      for (const phone of text.match(/\+?\d[\d ()-]{8,}\d/g) ?? []) {
        if (/^\d{4}-\d{2}-\d{2}/.test(phone) || /^\d{4,}$/.test(phone)) continue; // dates and plain numbers
        expect(phone, f).toMatch(/\b555\b/);
      }
    }
  });
});

describe('seeding the clinical stand-in against a fake project', () => {
  it('creates reviews, objects and three verified customers; a second run is a no-op', async () => {
    const { fake, r } = await seeded();
    expect(r.ok).toBe(true);
    const count = (container: string) => fake.objects.objects.filter((o) => o.container === container).length;
    expect(count('malva-schedule')).toBe(8);
    expect(count('malva-rx')).toBe(7);
    expect(count('malva-lab')).toBe(5);
    expect(count('malva-credential')).toBe(2);
    expect(count('malva-booking')).toBe(1);
    expect(fake.store.reviews).toHaveLength(REVIEWS.length);
    expect(fake.store.customers).toHaveLength(3);
    for (const c of fake.store.customers) {
      expect(c.isEmailVerified).toBe(true);
      expect(c.email).toMatch(/@example\.com$/);
      expect((c.addresses as unknown[]).length).toBe(1);
      expect((c.custom as { fields: { patientRef: string } }).fields.patientRef).toMatch(/^pt_/);
    }
    expect(fake.store.reviews.every((x) => (x.custom as { fields: { verifiedPatient: boolean } }).fields.verifiedPatient === true)).toBe(true);
    const writes = { resources: fake.log.length, objects: fake.objects.calls.filter((c) => c.op === 'post').length };
    const second = await runSeed(ctxOf(fake), { clinical: true, patientPassword: PASSWORD });
    expect(second).toMatchObject({ ok: true, changed: 0 });
    expect(fake.log.length).toBe(writes.resources);
    expect(fake.objects.calls.filter((c) => c.op === 'post').length).toBe(writes.objects);
  });

  it('object keys are valid Custom Object keys and creation is create-only (version 0)', async () => {
    const { fake } = await seeded();
    for (const o of fake.objects.objects) expect(o.key).toMatch(/^[-_~.a-zA-Z0-9]+$/);
    expect(fake.objects.objects.every((o) => o.version === 1)).toBe(true);
  });

  it('the password is passed to the customer create but is not part of any log line', async () => {
    const fake = createFakeRoot();
    const lines: string[] = [];
    await runSeed({ ...makeCtx(fake.root, { dryRun: false }, (l) => lines.push(l)), pauseMs: 0 }, { clinical: true, patientPassword: PASSWORD });
    expect(lines.join('\n')).not.toContain(PASSWORD);
  });

  it('dry run writes nothing', async () => {
    const fake = createFakeRoot();
    const r = await runSeed(ctxOf(fake, true), { clinical: true, patientPassword: PASSWORD });
    expect(r.changed).toBeGreaterThan(0);
    expect(fake.objects.calls.filter((c) => c.op === 'post')).toEqual([]);
    expect(fake.store.customers).toEqual([]);
    expect(fake.store.reviews).toEqual([]);
  });

  it('without a password the customers are skipped, the rest is seeded', async () => {
    const fake = createFakeRoot();
    const r = await runSeed(ctxOf(fake), { clinical: true });
    expect(r.ok).toBe(true);
    expect(fake.store.customers).toEqual([]);
    expect(fake.objects.objects.length).toBeGreaterThan(15);
  });

  it('clinical data is not seeded unless asked for (existing runs are unchanged)', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    expect(fake.objects.objects).toEqual([]);
    expect(fake.store.reviews).toEqual([]);
  });

  it('prescriptions are not overwritten (refills change when dispensed); a changed lab stops the run', async () => {
    const { fake } = await seeded();
    const rx = fake.objects.objects.find((o) => o.key === 'RX-77102');
    (rx?.value as { refillsLeft: number }).refillsLeft = 2;
    expect(await runSeed(ctxOf(fake), { clinical: true, patientPassword: PASSWORD })).toMatchObject({ ok: true, changed: 0 });
    (fake.objects.objects.find((o) => o.key === 'LAB-50301')?.value as { note: string }).note = 'edited';
    expect((await runSeed(ctxOf(fake), { clinical: true, patientPassword: PASSWORD })).ok).toBe(false);
  });
});
