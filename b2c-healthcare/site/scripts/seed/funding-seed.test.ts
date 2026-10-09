import { describe, expect, it } from 'vitest';
import { ALLOWANCE_MEMBERS, ALLOWANCE_MONTHLY_CENTS, allowanceObjectKey, cycleFor } from './data/allowances';
import { CREDENTIALS } from './data/credentials';
import { ALEX, JORDAN, SAM } from './data/patients';
import { PRESCRIPTIONS } from './data/prescriptions';
import { CUSTOM_TYPES } from './data/types';
import { REVIEWS } from './data/reviews';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';
import { runVerify } from './verify';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>) => ({ ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 });
async function seeded() {
  const fake = createFakeRoot();
  const r = await runSeed(ctxOf(fake), { clinical: true, patientPassword: 'unit-test-only-password' });
  for (const p of fake.store.products) {
    const count = REVIEWS.filter((x) => x.doctorKey === p.key).length;
    if (count) p.reviewRatingStatistics = { count, averageRating: 4.8 };
  }
  return { fake, r };
}
const failures = async (fake: ReturnType<typeof createFakeRoot>) => (await runVerify(fake.root, { images: false, clinical: true })).filter((c) => !c.ok).map((c) => c.name);
const objects = (fake: ReturnType<typeof createFakeRoot>, container: string) => fake.objects.objects.filter((o) => o.container === container);

describe('funding seed additions (U-13)', () => {
  it('seeds Sam\'s $50.00 allowance for the current cycle, the credentials, the controlled prescriptions and the funding scheme', async () => {
    const { fake, r } = await seeded();
    expect(r.ok).toBe(true);
    const cycle = cycleFor(new Date());
    const allowance = objects(fake, 'malva-allowance');
    expect(allowance.map((o) => o.key)).toEqual([allowanceObjectKey(SAM.patientRef, cycle)]);
    expect(allowance[0]?.value).toMatchObject({ patientRef: SAM.patientRef, granted: ALLOWANCE_MONTHLY_CENTS, monthly: 5000, consumed: 0, lapsed: 0, currency: 'USD' });
    expect(ALLOWANCE_MEMBERS).toEqual([{ patientRef: SAM.patientRef, monthly: 5000 }]);
    expect(objects(fake, 'malva-credential').map((o) => [(o.value as { patientRef: string }).patientRef, (o.value as { status: string }).status])).toEqual(expect.arrayContaining([[SAM.patientRef, 'active'], [JORDAN.patientRef, 'pending']]));
    expect(CREDENTIALS.some((c) => c.patientRef === ALEX.patientRef)).toBe(false);
    for (const patient of [SAM, ALEX, JORDAN]) {
      expect(PRESCRIPTIONS.some((rx) => rx.patientRef === patient.patientRef && rx.lines.some((l) => /tramadol|alprazolam/.test(l.sku)))).toBe(true);
    }
    const sam = fake.store.customers.find((c) => c.email === SAM.email);
    expect((sam?.custom as { fields: { fundingScheme: string } }).fields.fundingScheme).toBe('Demo Health Plan');
  });

  it('a second run changes nothing and never resets a drawn balance', async () => {
    const { fake } = await seeded();
    const cycle = cycleFor(new Date());
    const key = allowanceObjectKey(SAM.patientRef, cycle);
    const stored = objects(fake, 'malva-allowance').find((o) => o.key === key)!;
    (stored.value as { consumed: number }).consumed = 1500;
    const again = await runSeed(ctxOf(fake), { clinical: true, patientPassword: 'unit-test-only-password' });
    expect(again.ok).toBe(true);
    expect(again.changed).toBe(0);
    expect((objects(fake, 'malva-allowance').find((o) => o.key === key)!.value as { consumed: number }).consumed).toBe(1500);
  });

  it('the line type carries the fields the funding work writes', () => {
    const fields = CUSTOM_TYPES.find((t) => t.key === 'mlv-rx-line')!.fieldDefinitions.map((f) => f.name);
    expect(fields).toEqual(expect.arrayContaining(['coveredAmount', 'eligibleForRestricted', 'credentialRef', 'credentialValidTo', 'settlement']));
    expect(CUSTOM_TYPES.find((t) => t.key === 'mlv-order-meta')!.fieldDefinitions.map((f) => f.name)).toEqual(['allowanceApplied', 'restrictedApplied']);
  });

  it('seed:verify passes on a seeded project and reports a missing allowance, a changed credential and a wrong funding scheme', async () => {
    const { fake } = await seeded();
    expect(await failures(fake)).toEqual([]);
    fake.objects.objects = fake.objects.objects.filter((o) => o.container !== 'malva-allowance');
    (fake.objects.objects.find((o) => o.container === 'malva-credential' && (o.value as { patientRef: string }).patientRef === JORDAN.patientRef)!.value as { status: string }).status = 'active';
    (fake.store.customers.find((c) => c.email === SAM.email)!.custom as { fields: Record<string, unknown> }).fields.fundingScheme = 'Other plan';
    const failed = await failures(fake);
    expect(failed).toEqual(expect.arrayContaining([
      'malva-allowance holds a monthly grant for every allowance member (Sam: $50.00)',
      'credentials: Sam has a valid schedule-iv credential, Jordan a pending one, Alex none',
      'funding scheme: Sam is on Demo Health Plan, the others have none',
    ]));
  });
});
