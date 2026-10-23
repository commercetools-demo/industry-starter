import type { DroppedLine } from '@/lib/types';

/** sessionStorage key of the lines a region switch could not move (client side, shown by `DroppedLinesNotice`). */
export const DROPPED_LINES_KEY = 'mcf-dropped-lines';
export const DROPPED_LINES_EVENT = 'mcf-dropped-lines-change';

/**
 * Remembers the lines a region switch could not move until the shopper dismisses the notice (an empty list clears it).
 * sessionStorage survives the navigation that follows the switch; names only, no personal data.
 */
export function storeDroppedLines(lines: DroppedLine[]): void {
  try {
    if (lines.length > 0) sessionStorage.setItem(DROPPED_LINES_KEY, JSON.stringify(lines));
    else sessionStorage.removeItem(DROPPED_LINES_KEY);
    window.dispatchEvent(new Event(DROPPED_LINES_EVENT));
  } catch {
    // storage unavailable: no notice, the switch itself still worked
  }
}
