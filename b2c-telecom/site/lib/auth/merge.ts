// Pure. What the buyer is told after a sign-in merged the anonymous bundle into the customer's bundle.
import type { Cart, MergeNote } from '@/lib/types';

/**
 * M's merge never drops a line (a conflict is a flagged issue, a phone plan is capped at 5 lines by `normalizeCart`), so nothing is
 * removed silently: lines the J/K rules now flag are listed so the buyer can resolve them in My bundle.
 */
export function buildMergeNotes(cart: Cart | null): MergeNote[] {
  if (!cart) return [];
  const flagged = new Set(cart.issues.map((issue) => issue.lineId).filter((id): id is string => id !== null));
  if (flagged.size === 0) return [];
  const names = cart.lines.filter((line) => flagged.has(line.id)).map((line) => line.name);
  return [{ key: 'review', count: flagged.size, names: [...new Set(names)].join(', ') }];
}
