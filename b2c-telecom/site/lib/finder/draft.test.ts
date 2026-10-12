import { addExtra, EMPTY_DRAFT, hasExtra, removeExtra, replacedBy, selectPlan, type DraftExtra } from './draft';

const extra = (offerKey: string, patch: Partial<DraftExtra> = {}): DraftExtra => ({ offerKey, sku: `MLV-${offerKey}`, name: offerKey, kind: 'addon', equipmentKind: null, ...patch });
const router = (offerKey: string): DraftExtra => extra(offerKey, { kind: 'equipment', equipmentKind: 'router' });

describe('finder draft', () => {
  it('adds and removes an extra without duplicates', () => {
    const once = addExtra(addExtra({ ...EMPTY_DRAFT, planKey: 'p' }, extra('a')), extra('a'));
    expect(once.extras).toHaveLength(1);
    expect(hasExtra(once, 'a')).toBe(true);
    expect(removeExtra(once, 'a').extras).toEqual([]);
  });

  it('one equipment item per kind: the second router replaces the first, add-ons are untouched', () => {
    let draft = addExtra({ planKey: 'p', extras: [] }, extra('netflix'));
    draft = addExtra(draft, router('r1'));
    expect(replacedBy(draft, router('r2'))?.offerKey).toBe('r1');
    draft = addExtra(draft, router('r2'));
    expect(draft.extras.map((entry) => entry.offerKey)).toEqual(['netflix', 'r2']);
  });

  it('a plan change clears the draft and says so only when something was cleared', () => {
    const draft = addExtra({ planKey: 'a', extras: [] }, extra('x'));
    expect(selectPlan(draft, 'b')).toEqual({ draft: { planKey: 'b', extras: [] }, cleared: true });
    expect(selectPlan({ planKey: 'a', extras: [] }, 'b').cleared).toBe(false);
    expect(selectPlan(draft, 'a')).toEqual({ draft, cleared: false });
  });
});
