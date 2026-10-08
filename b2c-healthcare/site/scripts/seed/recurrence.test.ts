import { describe, expect, it } from 'vitest';
import { LIST_LINE_TYPE, RECURRENCE_POLICIES } from './data/recurrence';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { listAndRecurrenceSteps } from './recurrence-steps';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>) => ({ ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 });

describe('subscriptions-and-recurring-orders: seeded Recurrence Policies', () => {
  it('mlv-monthly and mlv-quarterly are StandardSchedules of 1 and 3 months', () => {
    expect(RECURRENCE_POLICIES.map((p) => [p.key, p.schedule])).toEqual([
      ['mlv-monthly', { type: 'standard', intervalUnit: 'Months', value: 1 }],
      ['mlv-quarterly', { type: 'standard', intervalUnit: 'Months', value: 3 }],
    ]);
  });

  it('the list line type holds the prescription reference and the saved price, no sig', () => {
    expect(LIST_LINE_TYPE.key).toBe('mlv-list-line');
    expect(LIST_LINE_TYPE.resourceTypeIds).toEqual(['shopping-list-line-item']);
    expect(LIST_LINE_TYPE.fieldDefinitions.map((f) => f.name)).toEqual(['rxNumber', 'rxLineRef', 'savedUnitPrice']);
  });

  it('seeding is idempotent: three creates, then zero changes', async () => {
    const fake = createFakeRoot();
    expect((await runSteps(listAndRecurrenceSteps(ctxOf(fake)), () => {})).changed).toBe(3);
    expect(await runSteps(listAndRecurrenceSteps(ctxOf(fake)), () => {})).toMatchObject({ ok: true, changed: 0 });
    expect(fake.store.recurrencePolicies.map((p) => p.key)).toEqual(['mlv-monthly', 'mlv-quarterly']);
  });

  it('a policy whose cadence differs in the project is reported, not overwritten (refills would change cadence)', async () => {
    const fake = createFakeRoot({ recurrencePolicies: [{ key: 'mlv-monthly', schedule: { type: 'standard', intervalUnit: 'Weeks', value: 1 } }] });
    const r = await runSteps(listAndRecurrenceSteps(ctxOf(fake)), () => {});
    expect(r.ok).toBe(false);
    expect(fake.store.recurrencePolicies.find((p) => p.key === 'mlv-monthly')?.schedule).toMatchObject({ intervalUnit: 'Weeks' });
  });
});
