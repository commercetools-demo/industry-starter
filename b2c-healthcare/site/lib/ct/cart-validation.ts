import 'server-only';
import type { Patient } from '@/lib/ct/patient';
import { RxNotFoundError, validateRxSelection, type RxContext } from '@/lib/ct/prescriptions';
import type { CartLineIssue, CartLineProblem, RxLineView } from '@/lib/types';

const REFUSAL_REASONS: ReadonlySet<string> = new Set<CartLineIssue>(['NO_REFILLS', 'EXPIRED', 'OUT_OF_STOCK', 'CEILING', 'SHELF_LIFE']);

/** Row of the prescription card that cannot be dispensed -> the cart line's problem. */
export function problemOf(row: RxLineView): CartLineProblem {
  const reason: CartLineIssue = REFUSAL_REASONS.has(row.status) ? (row.status as CartLineIssue) : 'UNAVAILABLE';
  return {
    reason,
    ...(row.remaining !== undefined ? { remaining: row.remaining } : {}),
    ...(row.ceiling !== undefined ? { ceiling: row.ceiling } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
  };
}

export interface LineToCheck {
  id: string;
  /** Null for a line without prescription fields. */
  rx: { rxNumber: string; rxLineRef: string } | null;
}

/**
 * Re-runs the dispensing rules (N, `validateRxSelection`) for every cart line, one check per prescription.
 * Returns the problems by line id; lines that pass are absent. Nothing is removed or changed: the BFF only flags.
 * A prescription that is no longer found makes its lines `UNAVAILABLE`.
 */
export async function checkLines(patient: Patient, lines: LineToCheck[], ctx: RxContext): Promise<Map<string, CartLineProblem>> {
  const problems = new Map<string, CartLineProblem>();
  const byRx = new Map<string, { id: string; lineRef: string }[]>();
  for (const line of lines) {
    if (!line.rx) problems.set(line.id, { reason: 'UNAVAILABLE' });
    else byRx.set(line.rx.rxNumber, [...(byRx.get(line.rx.rxNumber) ?? []), { id: line.id, lineRef: line.rx.rxLineRef }]);
  }
  await Promise.all(
    [...byRx].map(async ([rxNumber, group]) => {
      try {
        const result = await validateRxSelection(patient, rxNumber, group.map((l) => l.lineRef), ctx);
        for (const row of result.refused) {
          for (const line of group.filter((l) => l.lineRef === row.lineRef)) problems.set(line.id, problemOf(row));
        }
      } catch (error) {
        if (!(error instanceof RxNotFoundError)) throw error;
        for (const line of group) problems.set(line.id, { reason: 'UNAVAILABLE' });
      }
    }),
  );
  return problems;
}
