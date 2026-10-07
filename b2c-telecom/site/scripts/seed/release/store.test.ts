// @vitest-environment node
import { FakeCt } from '../test/fake-ct';
import { getRecord, listRecords, putRecord } from './store';
import type { ReleaseRecord } from './types';

const record = (key: string, status: ReleaseRecord['status'] = 'scheduled'): ReleaseRecord => ({
  key,
  name: key,
  author: 'a',
  appliedBy: 'b',
  appliedAt: '2026-10-07T10:00:00Z',
  releaseAt: '2026-10-07T11:00:00Z',
  manifestSha256: 'abc',
  expedited: false,
  externalAck: true,
  status,
  changes: [],
  before: {},
});

describe('release store', () => {
  it('upserts a record into the malva-releases container and reads it back', async () => {
    const fake = new FakeCt();
    await putRecord(fake, record('malva-rel-one', 'applying'));
    await putRecord(fake, record('malva-rel-one', 'scheduled'));
    await putRecord(fake, record('malva-rel-two'));
    expect(fake.list('custom-objects').map((o) => [o.container, o.key])).toEqual([
      ['malva-releases', 'malva-rel-one'],
      ['malva-releases', 'malva-rel-two'],
    ]);
    expect((await getRecord(fake, 'malva-rel-one'))?.status).toBe('scheduled');
    expect(await getRecord(fake, 'malva-rel-none')).toBeNull();
    expect((await listRecords(fake)).map((r) => r.key)).toEqual(['malva-rel-one', 'malva-rel-two']);
  });

  it('lists only its own container', async () => {
    const fake = new FakeCt();
    fake.seed('custom-objects', { container: 'malva-serviceability', key: '10001', value: {} });
    await putRecord(fake, record('malva-rel-one'));
    expect((await listRecords(fake)).map((r) => r.key)).toEqual(['malva-rel-one']);
  });
});
