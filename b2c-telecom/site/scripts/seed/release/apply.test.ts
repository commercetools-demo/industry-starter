// @vitest-environment node
import { EXIT } from '../config';
import { CtHttpError, type CtApi } from '../lib';
import type { FakeCt } from '../test/fake-ct';
import { applyRelease, verifyApplied } from './apply';
import { buildCatalogIndex } from './catalogIndex';
import { RELEASE_AT, exampleManifest, makeProject, stateOf } from './fixture';
import { testDeps as deps } from './testDeps';
import { applyToIndex, discountEffectiveAt } from './model';
import { purchasableAt } from './preview';
import { getRecord } from './store';
import type { ReleaseManifest } from './types';

const at = (iso: string): Date => new Date(iso);
const minus = (iso: string, ms: number): Date => new Date(Date.parse(iso) - ms);

async function catalogAt(fake: FakeCt, when: Date): Promise<{ offers: string[]; usd: Record<string, number | undefined>; discounts: string[] }> {
  const index = await buildCatalogIndex(fake);
  const rows = purchasableAt(index, when);
  return {
    offers: rows.map((r) => r.key),
    usd: Object.fromEntries(rows.map((r) => [r.key, r.usd])),
    discounts: index.discounts.filter((d) => discountEffectiveAt(d, when)).map((d) => d.key),
  };
}

describe('applyRelease', () => {
  it('Nothing visible before the release: offers, prices and discounts are inert until releaseAt', async () => {
    const fake = await makeProject();
    const before = await catalogAt(fake, at(RELEASE_AT));
    const outcome = await applyRelease(exampleManifest(), deps(fake));
    expect(outcome.exitCode).toBe(EXIT.OK);
    expect(outcome.status).toBe('scheduled');

    const justBefore = await catalogAt(fake, minus(RELEASE_AT, 1000));
    expect(justBefore.offers).not.toContain('malva-offer-phone-unlimited-summer');
    expect(justBefore.offers).toContain('malva-offer-phone-online-only');
    expect(justBefore.discounts).not.toContain('malva-cd-rel-example-5-off');
    expect(justBefore.offers.sort()).toEqual(before.offers.filter((k) => k !== 'malva-offer-phone-unlimited-summer').sort());

    // the new offer exists and is published, but every one of its prices starts at the release instant
    const created = fake.byKey('products', 'malva-offer-phone-unlimited-summer');
    expect((created?.masterData as { published: boolean }).published).toBe(true);
    const variant = (created?.masterData as { staged: { masterVariant: { prices: { validFrom?: string }[]; attributes: { name: string; value: string }[] } } }).staged.masterVariant;
    expect(variant.prices.every((p) => p.validFrom === RELEASE_AT)).toBe(true);
    expect(variant.attributes.find((a) => a.name === 'start-time')?.value).toBe(RELEASE_AT);
  });

  it('Everything visible after it: at releaseAt offers, prices and promotion are effective together', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), deps(fake));
    const atRelease = await catalogAt(fake, at(RELEASE_AT));
    expect(atRelease.offers).toContain('malva-offer-phone-unlimited-summer');
    expect(atRelease.usd['malva-offer-phone-unlimited-summer']).toBe(4000);
    expect(atRelease.offers).not.toContain('malva-offer-phone-online-only');
    expect(atRelease.discounts).toContain('malva-cd-rel-example-5-off');
    const later = await catalogAt(fake, new Date(Date.parse(RELEASE_AT) + 3600 * 1000));
    expect(later.offers).toEqual(atRelease.offers);
  });

  it('records the release as scheduled with the hash, the operator and the changes', async () => {
    const fake = await makeProject();
    const outcome = await applyRelease(exampleManifest(), deps(fake));
    const record = await getRecord(fake, 'malva-rel-example-summer-unlimited');
    expect(record?.status).toBe('scheduled');
    expect(record?.appliedBy).toBe('claude');
    expect(record?.manifestSha256).toBe(outcome.record?.manifestSha256);
    expect(record?.changes.some((c) => c.resource === 'price' && c.after === 4000)).toBe(true);
  });

  it.each([1, 2, 3])('a failure after write %i restores the project exactly and records rolled-back', async (n) => {
    const fake = await makeProject();
    const initial = stateOf(fake);
    const d = deps(fake, { failAfter: n });
    const outcome = await applyRelease(exampleManifest(), d);
    expect(outcome.exitCode).toBe(EXIT.FAILED);
    expect(outcome.status).toBe('rolled-back');
    expect(stateOf(fake)).toBe(initial);
    expect((await getRecord(fake, 'malva-rel-example-summer-unlimited'))?.status).toBe('rolled-back');
    // and a second attempt without the hook succeeds
    const again = await applyRelease(exampleManifest(), deps(fake));
    expect(again.status).toBe('scheduled');
  });

  it('a compensation that fails exits 7 and records inconsistent with the keys to inspect', async () => {
    const fake = await makeProject();
    const faulty: CtApi = {
      get: (p, q) => fake.get(p, q),
      post: (p, b) => fake.post(p, b),
      del: async () => {
        throw new CtHttpError(500, 'delete refused', 'General');
      },
      get writes() {
        return fake.writes;
      },
      set writes(v: number) {
        fake.writes = v;
      },
    };
    const d = deps(faulty, { failAfter: 2 });
    const outcome = await applyRelease(exampleManifest(), d);
    expect(outcome.exitCode).toBe(7);
    expect(outcome.status).toBe('inconsistent');
    expect(outcome.record?.inconsistentKeys).toEqual(expect.arrayContaining(['malva-offer-phone-unlimited-summer', 'malva-cd-rel-example-5-off']));
    expect(d.lines.join('\n')).toContain('release:verify');
    expect((await getRecord(fake, 'malva-rel-example-summer-unlimited'))?.status).toBe('inconsistent');
  });

  it('applying a scheduled release again changes nothing', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), deps(fake));
    const writes = fake.writes;
    const state = stateOf(fake);
    const again = await applyRelease(exampleManifest(), deps(fake));
    expect(again.status).toBe('noop');
    expect(again.exitCode).toBe(EXIT.OK);
    expect(fake.writes).toBe(writes);
    expect(stateOf(fake)).toBe(state);
  });

  it('the same key with other content is refused while the first is scheduled', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), deps(fake));
    const other: ReleaseManifest = { ...exampleManifest(), name: 'Changed' };
    const outcome = await applyRelease(other, deps(fake));
    expect(outcome.exitCode).toBe(EXIT.PREFLIGHT);
  });

  it('refuses a releaseAt less than 10 minutes away and writes nothing', async () => {
    const fake = await makeProject();
    const d = deps(fake, { now: () => minus(RELEASE_AT, 9 * 60 * 1000) });
    const outcome = await applyRelease(exampleManifest(), d);
    expect(outcome.exitCode).toBe(EXIT.PREFLIGHT);
    expect(d.lines.join('\n')).toContain('LEAD_TIME');
    expect(fake.writes).toBe(0);
    const ok = await applyRelease(exampleManifest(), deps(fake, { now: () => minus(RELEASE_AT, 10 * 60 * 1000) }));
    expect(ok.status).toBe('scheduled');
  });

  it('expedite allows 2 minutes only with a reason of at least 20 characters', async () => {
    const fake = await makeProject();
    const twoMinutes = { now: () => minus(RELEASE_AT, 3 * 60 * 1000) };
    const base = exampleManifest();
    const noReason = await applyRelease({ ...base, expedite: { reason: 'too short' } }, deps(fake, twoMinutes));
    expect(noReason.exitCode).toBe(EXIT.PREFLIGHT);
    const tooClose = await applyRelease({ ...base, expedite: { reason: 'Price error found in the live offer' } }, deps(fake, { now: () => minus(RELEASE_AT, 60 * 1000) }));
    expect(tooClose.exitCode).toBe(EXIT.PREFLIGHT);
    const ok = await applyRelease({ ...base, expedite: { reason: 'Price error found in the live offer' } }, deps(fake, twoMinutes));
    expect(ok.status).toBe('scheduled');
    expect(ok.record?.expedited).toBe(true);
    expect(ok.record?.expediteReason).toBe('Price error found in the live offer');
  });

  it('a non-empty external checklist needs --ack', async () => {
    const fake = await makeProject();
    const d = deps(fake, { ack: false });
    expect((await applyRelease(exampleManifest(), d)).exitCode).toBe(EXIT.PREFLIGHT);
    expect(fake.writes).toBe(0);
    const ok = await applyRelease(exampleManifest(), deps(fake, { ack: true }));
    expect(ok.record?.externalAck).toBe(true);
  });

  it('validation errors stop the apply before anything is written', async () => {
    const fake = await makeProject();
    const bad = { ...exampleManifest(), withdrawOffers: ['malva-offer-nope'], replaces: [] };
    const d = deps(fake);
    const outcome = await applyRelease(bad, d);
    expect(outcome.exitCode).toBe(EXIT.PREFLIGHT);
    expect(d.lines.join('\n')).toContain('DANGLING_KEY malva-offer-nope');
    expect(fake.writes).toBe(0);
  });

  it('verifyApplied names a key whose written state differs from the plan', async () => {
    const fake = await makeProject();
    const manifest = exampleManifest();
    await applyRelease(manifest, deps(fake));
    const index = await buildCatalogIndex(fake);
    const stripped = { ...index, offers: index.offers.filter((o) => o.key !== 'malva-offer-phone-unlimited-summer') };
    const problems = verifyApplied(applyToIndex(await buildCatalogIndex(await makeProject()), manifest), stripped, manifest);
    expect(problems.join(' ')).toContain('malva-offer-phone-unlimited-summer is missing');
  });
});
