import type { CartLineRef, CompatVerdict, Offer } from '@/lib/types';

/** Lines that can carry add-ons and equipment: base packages and bundles (D-026). */
export function planLinesOf(lines: CartLineRef[], offersByKey: Record<string, Offer>): CartLineRef[] {
  return lines.filter((line) => {
    const kind = offersByKey[line.offerKey]?.kind;
    return kind === 'base-package' || kind === 'bundle';
  });
}

export function dependentsOf(lines: CartLineRef[], parentLineItemId: string): CartLineRef[] {
  return lines.filter((line) => line.parentLineItemId === parentLineItemId);
}

/**
 * What removing a line removes. A plan line takes every dependent (add-ons and equipment) with it after the buyer confirms;
 * removing a dependent removes only itself.
 */
export function removalPlan(lines: CartLineRef[], lineItemId: string): { removeIds: string[]; dependentCount: number; requiresConfirmation: boolean } {
  const dependents = dependentsOf(lines, lineItemId);
  return { removeIds: [lineItemId, ...dependents.map((line) => line.lineItemId)], dependentCount: dependents.length, requiresConfirmation: dependents.length > 0 };
}

/** Dependent lines whose parent line no longer exists. */
export function findOrphans(lines: CartLineRef[]): CartLineRef[] {
  const ids = new Set(lines.map((line) => line.lineItemId));
  return lines.filter((line) => line.parentLineItemId !== undefined && !ids.has(line.parentLineItemId));
}

/** Add-ons and equipment mirror the parent's quantity (a phone plan's quantity is its number of lines, D-014). */
export const dependentQuantity = (parentQuantity: number): number => parentQuantity;

/** The two custom fields of type `malva-line-item` M writes on the dependent line. Throws unless the verdict allows it with a parent. */
export function attachmentFields(verdict: CompatVerdict, candidate: Offer): { offerKey: string; parentLineItemId: string } {
  if (verdict.status !== 'allowed' || verdict.parentLineItemId === undefined) {
    throw new Error(`Cannot attach ${candidate.key}: the verdict is ${verdict.status} and names no parent line`);
  }
  return { offerKey: candidate.key, parentLineItemId: verdict.parentLineItemId };
}
