// @vitest-environment node
import { applyRelease } from '../release/apply';
import { NOW, exampleManifest, makeProject } from '../release/fixture';
import { testDeps } from '../release/testDeps';
import { getRecord, putRecord } from '../release/store';
import { releaseCheck } from './releases';

const KEY = 'malva-rel-example-summer-unlimited';

describe('seed:verify release check', () => {
  it('passes with no records and with a scheduled release present', async () => {
    const fake = await makeProject();
    const check = releaseCheck(() => NOW);
    expect((await check.run(fake, { projectKey: 'x' })).ok).toBe(true);
    await applyRelease(exampleManifest(), testDeps(fake));
    const result = await check.run(fake, { projectKey: 'x' });
    expect(result).toEqual({ ok: true, detail: '1 record(s), 1 scheduled' });
    expect(fake.writes).toBeGreaterThan(0);
    const writes = fake.writes;
    await check.run(fake, { projectKey: 'x' });
    expect(fake.writes).toBe(writes);
  });

  it('fails naming the key when the anchor product of a scheduled offer was deleted', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), testDeps(fake));
    const anchor = fake.byKey('products', 'malva-phone-unlimited') as { version: number };
    await fake.post('products/key=malva-phone-unlimited', { version: anchor.version, actions: [{ action: 'unpublish' }] });
    const stored = fake.byKey('products', 'malva-phone-unlimited') as { version: number };
    await fake.del('products/key=malva-phone-unlimited', { version: stored.version });
    const result = await releaseCheck(() => NOW).run(fake, { projectKey: 'x' });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain(`${KEY}`);
    expect(result.detail).toContain('DANGLING_KEY malva-phone-unlimited');
  });

  it('fails for a record stuck in applying or inconsistent', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), testDeps(fake));
    const record = await getRecord(fake, KEY);
    if (!record) throw new Error('record missing');
    await putRecord(fake, { ...record, status: 'inconsistent', inconsistentKeys: ['malva-offer-phone-unlimited-summer'] });
    const result = await releaseCheck(() => NOW).run(fake, { projectKey: 'x' });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('malva-offer-phone-unlimited-summer');
  });

  it('does not revalidate a release that already took effect', async () => {
    const fake = await makeProject();
    await applyRelease(exampleManifest(), testDeps(fake));
    const later = new Date(Date.parse(exampleManifest().releaseAt) + 3600 * 1000);
    expect((await releaseCheck(() => later).run(fake, { projectKey: 'x' })).ok).toBe(true);
  });
});
