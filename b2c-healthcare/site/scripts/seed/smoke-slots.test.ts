import { describe, expect, it } from 'vitest';
import { createFakeObjects } from '../../test/fake-custom-objects';
import type { Root } from './lib';
import { smokeSlots } from './smoke-slots';

const NOW = new Date('2026-10-08T05:00:00Z');

describe('smoke-slots.ts against fake Custom Objects', () => {
  it('prints free slots, the second claim of the same slot fails with 409, and the test claim is removed', async () => {
    const fake = createFakeObjects();
    const root = { customObjects: fake.customObjects } as unknown as Root;
    await root.customObjects().post({ body: { container: 'malva-schedule', key: 'mlv-doc-test', value: { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['09:00', '16:00'] } } } }).execute();
    const lines: string[] = [];
    const r = await smokeSlots(root, 'mlv-doc-test', 'office', NOW, (l) => lines.push(l));
    expect(r).toMatchObject({ free: 2, secondClaimRejected: true });
    expect(lines.join('\n')).toContain('PASS');
    expect(fake.objects.filter((o) => o.container === 'malva-slot-claim')).toEqual([]);
  });

  it('a missing schedule is a clear error', async () => {
    const root = { customObjects: createFakeObjects().customObjects } as unknown as Root;
    await expect(smokeSlots(root, 'mlv-doc-none')).rejects.toThrow('npm run seed');
  });
});
