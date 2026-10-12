// Pure. The finder's draft: the extras (add-ons and equipment) the buyer picked for the selected plan. Nothing here touches the cart; the
// draft is applied on Continue.

export interface DraftExtra {
  offerKey: string;
  sku: string;
  name: string;
  kind: 'addon' | 'equipment';
  /** Equipment only: a plan holds one item per kind, so adding a second router replaces the first. */
  equipmentKind: string | null;
}

export interface Draft {
  planKey: string | null;
  extras: DraftExtra[];
}

export const EMPTY_DRAFT: Draft = { planKey: null, extras: [] };

/** Selecting another plan clears the draft (the extras were chosen for the old plan); `cleared` tells the page to say so once. */
export function selectPlan(draft: Draft, planKey: string | null): { draft: Draft; cleared: boolean } {
  if (draft.planKey === planKey) return { draft, cleared: false };
  return { draft: { planKey, extras: [] }, cleared: draft.extras.length > 0 };
}

/** The extra the new one pushes out (same equipment kind), if any. */
export function replacedBy(draft: Draft, extra: DraftExtra): DraftExtra | null {
  if (extra.kind !== 'equipment' || extra.equipmentKind === null) return null;
  return draft.extras.find((entry) => entry.kind === 'equipment' && entry.equipmentKind === extra.equipmentKind && entry.offerKey !== extra.offerKey) ?? null;
}

export function addExtra(draft: Draft, extra: DraftExtra): Draft {
  const pushedOut = replacedBy(draft, extra);
  const rest = draft.extras.filter((entry) => entry.offerKey !== extra.offerKey && entry !== pushedOut);
  return { ...draft, extras: [...rest, extra] };
}

export function removeExtra(draft: Draft, offerKey: string): Draft {
  return { ...draft, extras: draft.extras.filter((entry) => entry.offerKey !== offerKey) };
}

export const hasExtra = (draft: Draft, offerKey: string): boolean => draft.extras.some((entry) => entry.offerKey === offerKey);
