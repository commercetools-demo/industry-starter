import { describe, expect, it } from 'vitest';
import { allowanceCycle } from './seed/data/allowances';
import { createFakeRoot } from './seed/fake-root';
import { runReload } from './reload-allowances';

const SAM = 'pt_8k2m4q7x';
const OCT = new Date('2026-10-20T12:00:00Z');
const NOV = new Date('2026-11-01T00:10:00Z');

function projectWith(consumed: number) {
  const fake = createFakeRoot();
  const value = { ...allowanceCycle(SAM, 5000, '2026-10'), consumed };
  fake.objects.objects.push({ id: 'a1', container: 'malva-allowance', key: `${SAM}_2026-10`, version: 1, value, createdAt: '', lastModifiedAt: '' });
  return fake;
}
const cycle = (fake: ReturnType<typeof createFakeRoot>, key: string) => fake.objects.objects.find((o) => o.container === 'malva-allowance' && o.key === `${SAM}_${key}`);
const quiet = { log: () => undefined };

describe('benefit-allowance-drawdown: reload-allowances script (U-07)', () => {
  it('Cycle reload: the new cycle is granted and the unspent remainder of the old one is forfeited, not carried over', async () => {
    const fake = projectWith(1500);
    const run = await runReload(fake.root, NOV, quiet);
    expect(run).toMatchObject({ members: 1, granted: 1, lapsedCycles: 1, lapsedCents: 3500, dryRun: false });
    expect(cycle(fake, '2026-11')?.value).toMatchObject({ granted: 5000, consumed: 0, lapsed: 0 });
    expect(cycle(fake, '2026-10')?.value).toMatchObject({ lapsed: 3500 });
  });

  it('run twice = once: the second run changes nothing', async () => {
    const fake = projectWith(1500);
    await runReload(fake.root, NOV, quiet);
    const after = JSON.stringify(fake.objects.objects);
    const second = await runReload(fake.root, NOV, quiet);
    expect(second).toMatchObject({ granted: 0, lapsedCycles: 0, lapsedCents: 0 });
    expect(JSON.stringify(fake.objects.objects)).toBe(after);
  });

  it('within the same cycle nothing is granted or forfeited', async () => {
    const fake = projectWith(1500);
    expect(await runReload(fake.root, OCT, quiet)).toMatchObject({ granted: 0, lapsedCycles: 0 });
    expect(cycle(fake, '2026-10')?.value).toMatchObject({ lapsed: 0, consumed: 1500 });
  });

  it('--dry-run reports what would change and writes nothing', async () => {
    const fake = projectWith(1500);
    const before = JSON.stringify(fake.objects.objects);
    const run = await runReload(fake.root, NOV, { ...quiet, dryRun: true });
    expect(run).toMatchObject({ granted: 1, lapsedCycles: 1, lapsedCents: 3500, dryRun: true });
    expect(JSON.stringify(fake.objects.objects)).toBe(before);
  });

  it('a member who spent everything is granted the new cycle with nothing to forfeit', async () => {
    const fake = projectWith(5000);
    expect(await runReload(fake.root, NOV, quiet)).toMatchObject({ granted: 1, lapsedCycles: 0, lapsedCents: 0 });
    expect(cycle(fake, '2026-11')?.value).toMatchObject({ granted: 5000 });
  });
});
