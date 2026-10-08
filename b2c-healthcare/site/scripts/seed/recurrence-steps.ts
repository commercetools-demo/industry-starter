import { LIST_LINE_TYPE, RECURRENCE_POLICIES } from './data/recurrence';
import { diffType, ensureKeyed, type Ctx, type Rec, type Step } from './lib';

/** A stored policy is compared by its schedule: a different interval would silently change every refill that uses it. */
export const diffPolicy = (e: Rec, d: Rec): string | null => {
  const norm = (r: Rec) => {
    const s = (r.schedule as { type?: string; intervalUnit?: string; value?: number; day?: number } | undefined) ?? {};
    return JSON.stringify([s.type, s.intervalUnit ?? null, s.value ?? null, s.day ?? null]);
  };
  return norm(e) === norm(d) ? null : 'schedule differs (existing refills would change cadence: fix it in the Merchant Center)';
};

/** Saved lists and auto-refill (workstream T): the list line type, then the two Recurrence Policies. */
export function listAndRecurrenceSteps(ctx: Ctx): Step[] {
  return [
    { name: `type ${LIST_LINE_TYPE.key}`, run: () => ensureKeyed(ctx, 'types', LIST_LINE_TYPE, diffType) },
    ...RECURRENCE_POLICIES.map((p) => ({ name: `recurrence policy ${p.key}`, run: () => ensureKeyed(ctx, 'recurrencePolicies', p, diffPolicy) })),
  ];
}
