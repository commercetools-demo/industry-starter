import { describe, expect, it } from 'vitest';
import { REVIEWS } from './data/reviews';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';
import { formatChecks, runVerify } from './verify';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>) => ({ ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 });

/** Seeds everything, then plays the platform's part: review statistics roll up on the products. */
async function seeded() {
  const fake = createFakeRoot();
  await runSeed(ctxOf(fake), { clinical: true, patientPassword: 'unit-test-only-password' });
  for (const p of fake.store.products) {
    const count = REVIEWS.filter((r) => r.doctorKey === p.key).length;
    if (count) p.reviewRatingStatistics = { count, averageRating: 4.8 };
  }
  return fake;
}
const failures = async (fake: ReturnType<typeof createFakeRoot>) => (await runVerify(fake.root, { images: false, clinical: true })).filter((c) => !c.ok).map((c) => c.name);

describe('seed:verify clinical checks (F-07)', () => {
  it('a freshly seeded project passes every check, including the existing ones', async () => {
    const fake = await seeded();
    const checks = await runVerify(fake.root, { images: false, clinical: true });
    expect(formatChecks(checks.filter((c) => !c.ok))).toBe('');
    expect(checks.map((c) => c.name)).toEqual(expect.arrayContaining(['exactly three example.com patients', 'every RX line SKU exists as a product variant', 'every lab orderedByDoctorKey exists as a product']));
  });

  it('clinical checks are off by default (existing callers are unchanged)', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    const names = (await runVerify(fake.root, { images: false })).map((c) => c.name);
    expect(names.some((n) => n.startsWith('malva-'))).toBe(false);
  });

  it('fails on a lab ordered by an unknown doctor, an RX line with an unknown SKU, and a missing container object', async () => {
    const fake = await seeded();
    (fake.objects.objects.find((o) => o.key === 'LAB-50301')?.value as { orderedByDoctorKey: string }).orderedByDoctorKey = 'mlv-doc-nobody';
    (fake.objects.objects.find((o) => o.key === 'RX-77102')?.value as { lines: { sku: string }[] }).lines[0].sku = 'MED-unknown';
    fake.objects.objects = fake.objects.objects.filter((o) => o.key !== 'RX-31877');
    expect(await failures(fake)).toEqual(expect.arrayContaining(['every lab orderedByDoctorKey exists as a product', 'every RX line SKU exists as a product variant', 'malva-rx holds 7 prescriptions']));
  });

  it('fails when Sam\'s prescription differs from the prototype or RX-48213 has refills', async () => {
    const fake = await seeded();
    const rx = fake.objects.objects.find((o) => o.key === 'RX-48213')?.value as { refillsLeft: number; lines: { qty: number }[] };
    rx.refillsLeft = 1;
    rx.lines[0].qty = 99;
    const failed = await failures(fake);
    expect(failed).toContain('Sam Rivera has RX-48213 and RX-77102 as in the prototype');
    expect(failed.some((n) => n.startsWith('RX-48213 has 0 refills'))).toBe(true);
  });

  it('fails on a fourth patient, an unverified patient, or reviews that are unverified or lack statistics', async () => {
    const fake = await seeded();
    fake.store.customers.push({ id: 'x', key: 'mlv-patient-extra', email: 'x@example.com' });
    (fake.store.customers[0] as { isEmailVerified: boolean }).isEmailVerified = false;
    (fake.store.reviews[0].custom as { fields: { verifiedPatient: boolean } }).fields.verifiedPatient = false;
    delete fake.store.products.find((p) => p.key === 'mlv-doc-amara-okafor')?.reviewRatingStatistics;
    expect(await failures(fake)).toEqual(expect.arrayContaining([
      'exactly three example.com patients',
      'patients have verified email, an address and the seeded patientRef',
      `${REVIEWS.length} seeded reviews, all with verifiedPatient`,
      'product rating statistics are non-zero for every doctor',
    ]));
  });
});
