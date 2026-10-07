// @vitest-environment node
import { applyRelease } from './apply';
import { RELEASE_AT, exampleManifest, makeProject } from './fixture';
import { testDeps as deps } from './testDeps';
import { defaultOperator, inEffectAt, pricesInEffectAt, renderHistory } from './history';
import { sha256OfManifest } from './parse';
import { buildRollbackManifest } from './plan';
import { listRecords } from './store';
import type { ReleaseSnapshot } from './types';

const KEY = 'malva-rel-example-summer-unlimited';
const after = (ms: number): Date => new Date(Date.parse(RELEASE_AT) + ms);

describe('release history', () => {
  it('Release recorded: history at a past moment names what was released, when and by whom', async () => {
    const fake = await makeProject();
    const manifest = exampleManifest();
    await applyRelease(manifest, deps(fake, { operator: 'claude' }));
    const records = await listRecords(fake);

    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record).toMatchObject({ key: KEY, author: 'Malva commerce team', appliedBy: 'claude', releaseAt: RELEASE_AT, status: 'scheduled' });
    expect(record.manifestSha256).toBe(sha256OfManifest(manifest));
    expect(record.changes.length).toBeGreaterThan(0);

    // "what was the price when order N was placed": a moment after releaseAt names the release, its operator and the price
    const lines = renderHistory(records, after(3600 * 1000)).join('\n');
    expect(lines).toContain(KEY);
    expect(lines).toContain('appliedBy "claude"');
    expect(pricesInEffectAt(records, after(3600 * 1000)).map((p) => [p.offerKey, p.centAmount])).toEqual(
      expect.arrayContaining([['malva-offer-phone-unlimited-summer', 4000]]),
    );
    // before the release instant it names nothing
    expect(inEffectAt(records, after(-1000))).toEqual([]);
    expect(pricesInEffectAt(records, after(-1000))).toEqual([]);
  });

  it('a rolled back release is no longer in effect once its rollback is', async () => {
    const fake = await makeProject();
    const manifest = exampleManifest();
    await applyRelease(manifest, deps(fake));
    const [original] = await listRecords(fake);
    const rollback = buildRollbackManifest(manifest, original.before as ReleaseSnapshot, { releaseAt: '2026-10-07T11:00:00Z' });
    await applyRelease(rollback, deps(fake, { now: () => after(60 * 1000), operator: 'ops' }));
    const records = await listRecords(fake);
    expect(inEffectAt(records, after(1500 * 1000)).map((r) => r.key)).toEqual([KEY]);
    expect(inEffectAt(records, new Date('2026-10-07T11:00:01Z')).map((r) => r.key)).toEqual([`${KEY}-rollback`]);
    expect(pricesInEffectAt(records, new Date('2026-10-07T11:00:01Z')).some((p) => p.offerKey === 'malva-offer-phone-unlimited-summer' && p.release === KEY)).toBe(false);
  });

  it('lists every record without --at and an operator name always exists', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), deps(fake));
    expect(renderHistory(await listRecords(fake)).join('\n')).toContain(`${KEY}  scheduled`);
    expect(defaultOperator().length).toBeGreaterThan(0);
  });
});
