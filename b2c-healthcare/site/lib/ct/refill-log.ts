import 'server-only';
import { CONTAINERS, getObject, putObject, queryObjects } from '@/lib/ct/custom-objects';
import type { RefillLogView, RefillOutcome, RefillReason } from '@/lib/refill-types';

/**
 * `malva-refill-log`: one Custom Object per scheduled check of one run of one recurring order. It records what the
 * gate decided (`allowed` / `skipped` / `stopped`) and why, so a run that did not happen is never mistaken for an
 * outage and the buyer can be told ("Last run: skipped, authorization expired"). It holds ids, a date and a reason
 * code only: no medication name, no RX number, no patient detail (health-data-minimization).
 * Key = recurring order id + the run's date-time (so a second check of the same run finds the first one).
 */

export interface RefillLogEntry {
  recurringOrderId: string;
  /** ISO instant of the check. */
  runAt: string;
  /** ISO instant the run was due (`nextOrderAt`). */
  runFor: string;
  outcome: RefillOutcome;
  reason?: RefillReason;
}

const safeId = (v: string) => v.replace(/[^\w-]/g, '');

/** Container keys allow `[-_~.a-zA-Z0-9]`. */
export const refillLogKey = (recurringOrderId: string, runFor: string): string => `${safeId(recurringOrderId)}.${runFor.replace(/\D/g, '')}`;

/** The entry for this run, when the run was already checked. */
export async function getRunLog(recurringOrderId: string, runFor: string): Promise<RefillLogEntry | null> {
  return (await getObject<RefillLogEntry>(CONTAINERS.refillLog, refillLogKey(recurringOrderId, runFor)))?.value ?? null;
}

/** Records the outcome of a check (a second write for the same run replaces the first). */
export async function writeRunLog(entry: RefillLogEntry): Promise<void> {
  await putObject<RefillLogEntry>(CONTAINERS.refillLog, refillLogKey(entry.recurringOrderId, entry.runFor), entry);
}

const view = (e: RefillLogEntry): RefillLogView => ({ runAt: e.runAt, outcome: e.outcome, ...(e.reason ? { reason: e.reason } : {}) });

/** The most recent check of each recurring order (one read for all ids), by id. */
export async function lastRunsOf(recurringOrderIds: string[]): Promise<Map<string, RefillLogView>> {
  const ids = [...new Set(recurringOrderIds.map(safeId).filter(Boolean))];
  const out = new Map<string, RefillLogView>();
  if (ids.length === 0) return out;
  const entries = await queryObjects<RefillLogEntry>(CONTAINERS.refillLog, `value(recurringOrderId in (${ids.map((i) => `"${i}"`).join(', ')}))`);
  const newest = new Map<string, RefillLogEntry>();
  for (const { value } of entries) {
    const have = newest.get(value.recurringOrderId);
    if (!have || value.runAt > have.runAt) newest.set(value.recurringOrderId, value);
  }
  for (const [id, entry] of newest) out.set(id, view(entry));
  return out;
}
