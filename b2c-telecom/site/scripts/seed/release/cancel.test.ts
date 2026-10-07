// @vitest-environment node
import { EXIT } from '../config';
import { applyRelease, cancelRelease } from './apply';
import { buildCatalogIndex } from './catalogIndex';
import { RELEASE_AT, exampleManifest, makeProject, stateOf } from './fixture';
import { testDeps as deps } from './testDeps';
import { discountEffectiveAt } from './model';
import { purchasableAt } from './preview';
import { getRecord } from './store';

const KEY = 'malva-rel-example-summer-unlimited';

describe('cancelRelease', () => {
  it('Release withdrawn before its time: nothing becomes purchasable after the time passes', async () => {
    const fake = await makeProject();
    const initial = stateOf(fake);
    await applyRelease(exampleManifest(), deps(fake));
    expect(stateOf(fake)).not.toBe(initial);

    const cancelled = await cancelRelease(KEY, deps(fake, { now: () => new Date(Date.parse(RELEASE_AT) - 5 * 60 * 1000) }));
    expect(cancelled.exitCode).toBe(EXIT.OK);
    expect(cancelled.status).toBe('withdrawn');
    expect((await getRecord(fake, KEY))?.status).toBe('withdrawn');
    expect(stateOf(fake)).toBe(initial);

    const index = await buildCatalogIndex(fake);
    for (const offset of [0, 1000, 3600 * 1000]) {
      const when = new Date(Date.parse(RELEASE_AT) + offset);
      const keys = purchasableAt(index, when).map((r) => r.key);
      expect(keys).not.toContain('malva-offer-phone-unlimited-summer');
      expect(keys).toContain('malva-offer-phone-online-only');
      expect(index.discounts.some((d) => d.key === 'malva-cd-rel-example-5-off' && discountEffectiveAt(d, when))).toBe(false);
    }
  });

  it('after releaseAt a cancel is refused and points to rollback', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), deps(fake));
    const state = stateOf(fake);
    const d = deps(fake, { now: () => new Date(Date.parse(RELEASE_AT) + 1000) });
    const outcome = await cancelRelease(KEY, d);
    expect(outcome.exitCode).toBe(EXIT.PREFLIGHT);
    expect(d.lines.join('\n')).toContain('release:rollback');
    expect(stateOf(fake)).toBe(state);
  });

  it('an unknown release and an already withdrawn release are handled without writes', async () => {
    const fake = await makeProject();
    expect((await cancelRelease('malva-rel-none', deps(fake))).exitCode).toBe(EXIT.PREFLIGHT);
    await applyRelease(exampleManifest(), deps(fake));
    await cancelRelease(KEY, deps(fake));
    const writes = fake.writes;
    expect((await cancelRelease(KEY, deps(fake))).status).toBe('noop');
    expect(fake.writes).toBe(writes);
  });
});
