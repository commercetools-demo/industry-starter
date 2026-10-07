import type { OfferKind } from '@/lib/types';

/**
 * The order a saved list is moved into My bundle: plans first, then handsets, then add-ons and equipment, so a line's parent exists
 * before its dependents (D-026). Lines of the same rank keep the order of the list.
 */
export function lineOrder(kind: OfferKind): number {
  switch (kind) {
    case 'base-package':
    case 'bundle':
      return 0;
    case 'device':
      return 1;
    case 'addon':
    case 'equipment':
      return 2;
  }
}

export function sortForBundle<T>(lines: readonly T[], kindOf: (line: T) => OfferKind): T[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => lineOrder(kindOf(a.line)) - lineOrder(kindOf(b.line)) || a.index - b.index)
    .map((entry) => entry.line);
}
