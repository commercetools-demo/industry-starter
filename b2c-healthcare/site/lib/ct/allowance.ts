import 'server-only';
import { CONTAINERS, createOnly, getObject, putObject, queryObjects, statusOf, type StoredObject } from '@/lib/ct/custom-objects';
import { loadFundingFixtures } from '@/lib/ct/fixtures';
import {
  allowanceKey,
  balanceOf,
  cycleOf,
  forfeitDate,
  type AllowanceCycle,
  type AllowanceLedgerEntry,
  type AllowanceView,
} from '@/lib/funding/allowance-types';
import { log } from '@/lib/log';

/**
 * Benefit allowance (workstream U, benefit-allowance-drawdown). One Custom Object per member per monthly cycle,
 * written only under optimistic concurrency (`version`), like the prescription ledger (N):
 *
 *  - `drawdown(orderId)` is idempotent on the order id: the draw is recorded in the cycle object in the SAME
 *    versioned write that raises `consumed` (a crash or a retry can never draw twice), and an index entry keyed by
 *    the order id lets a cancel find the cycle again;
 *  - two orders racing for one balance cannot both take it: the second write fails with 409, re-reads and draws
 *    what is left (a part-payment, never more than the balance);
 *  - `restoreAllowance(orderId)` gives the amount back to the cycle it came from if that cycle is still the open
 *    one; otherwise it reports `unrecoverable` (the amount lapsed with its cycle);
 *  - `grantCycle` and `reloadAllowances` are idempotent per member per cycle: unspent balance is forfeited (`lapsed`),
 *    never carried over.
 * Nothing here pays out: an allowance is a number that only a drawdown on an order reduces. There is no withdraw
 * or transfer function, and no route for one.
 */

const MAX_ATTEMPTS = 6;
const orderKey = (orderId: string) => orderId.replace(/[^-_~.a-zA-Z0-9]/g, '_');

/** Where the cycle objects live: Custom Objects, or an in-memory store under `MALVA_FIXTURES=1` (development only). */
export interface AllowanceStore {
  get<T>(container: string, key: string): Promise<StoredObject<T> | null>;
  put<T>(container: string, key: string, value: T, version?: number): Promise<StoredObject<T>>;
  createOnly<T>(container: string, key: string, value: T): Promise<boolean>;
  query<T>(container: string, where?: string): Promise<StoredObject<T>[]>;
}

const customObjectStore: AllowanceStore = { get: getObject, put: putObject, createOnly, query: queryObjects };

async function store(): Promise<AllowanceStore> {
  const fixtures = await loadFundingFixtures();
  return fixtures ? fixtures.fixtureStore : customObjectStore;
}

export class AllowanceContendedError extends Error {
  constructor() {
    super('allowance is contended; try again');
    this.name = 'AllowanceContendedError';
  }
}

async function readCycle(s: AllowanceStore, patientRef: string, cycle: string): Promise<StoredObject<AllowanceCycle> | null> {
  return s.get<AllowanceCycle>(CONTAINERS.allowance, allowanceKey(patientRef, cycle));
}

/** The member's allowance for the cycle `now` falls in, or null when none exists (the member has no allowance). */
export async function getAllowanceView(patientRef: string, now: Date = new Date()): Promise<AllowanceView | null> {
  const s = await store();
  const cycle = cycleOf(now);
  const current = await readCycle(s, patientRef, cycle);
  if (!current) return null;
  const value = current.value;
  // The previous cycle's forfeited amount, for the page (one more read).
  const [y, m] = cycle.split('-').map(Number);
  const previous = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const before = await readCycle(s, patientRef, previous);
  const balance = balanceOf(value);
  return {
    cycle,
    currency: value.currency,
    granted: value.granted,
    consumed: value.consumed,
    balance,
    forfeitsOn: forfeitDate(cycle),
    lapsing: balance,
    lastLapsed: before && before.value.lapsed > 0 ? { cycle: previous, amount: before.value.lapsed } : null,
  };
}

/** What the member can draw now, in cents (0 without an allowance). */
export async function getBalance(patientRef: string, now: Date = new Date()): Promise<number> {
  return (await getAllowanceView(patientRef, now))?.balance ?? 0;
}

export interface DrawdownResult {
  /** Cents drawn for this order (never more than the balance when it was drawn). */
  applied: number;
  /** True when this order had already drawn: nothing changed. */
  alreadyApplied: boolean;
  cycle: string | null;
}

/**
 * Draws `min(amount, balance)` for the order from the current cycle. Idempotent on `orderId`. Returns `applied: 0`
 * when the member has no allowance or nothing is left (the whole amount then goes to the next tender).
 */
export async function drawdown(patientRef: string, orderId: string, amount: number, now: Date = new Date()): Promise<DrawdownResult> {
  const s = await store();
  const cycle = cycleOf(now);
  const wanted = Math.max(0, Math.floor(amount));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await readCycle(s, patientRef, cycle);
    if (!stored) return { applied: 0, alreadyApplied: false, cycle: null };
    const value = stored.value;
    const done = value.drawdowns?.[orderId];
    if (done !== undefined) {
      await indexDraw(s, patientRef, orderId, cycle, done, now);
      return { applied: done, alreadyApplied: true, cycle };
    }
    const applied = Math.min(wanted, balanceOf(value));
    if (applied === 0) return { applied: 0, alreadyApplied: false, cycle };
    try {
      await s.put<AllowanceCycle>(CONTAINERS.allowance, allowanceKey(patientRef, cycle), { ...value, consumed: value.consumed + applied, drawdowns: { ...(value.drawdowns ?? {}), [orderId]: applied } }, stored.version);
    } catch (error) {
      if (statusOf(error) === 409) continue;
      throw error;
    }
    await indexDraw(s, patientRef, orderId, cycle, applied, now);
    return { applied, alreadyApplied: false, cycle };
  }
  throw new AllowanceContendedError();
}

async function indexDraw(s: AllowanceStore, patientRef: string, orderId: string, cycle: string, amount: number, now: Date): Promise<void> {
  const entry: AllowanceLedgerEntry = { orderId, patientRef, cycle, amount, at: now.toISOString() };
  await s.createOnly(CONTAINERS.allowanceLedger, orderKey(orderId), entry);
}

export interface RestoreAllowanceResult {
  /** `none` = the order drew nothing (or was never seen); `already` = restored before. */
  outcome: 'restored' | 'unrecoverable' | 'none' | 'already';
  amount: number;
}

/**
 * Gives the order's draw back (cancel or return). Idempotent: a second call changes nothing. The amount goes back
 * to the cycle it came from only while that cycle is still the open one; once the cycle has closed its remainder
 * was forfeited and this reports `unrecoverable`.
 */
export async function restoreAllowance(orderId: string, now: Date = new Date()): Promise<RestoreAllowanceResult> {
  const s = await store();
  const key = orderKey(orderId);
  const entry = await s.get<AllowanceLedgerEntry>(CONTAINERS.allowanceLedger, key);
  if (!entry) return { outcome: 'none', amount: 0 };
  if (entry.value.restoredAt) return { outcome: 'already', amount: entry.value.amount };
  const { patientRef, cycle, amount } = entry.value;

  let outcome: 'restored' | 'unrecoverable' = 'unrecoverable';
  if (cycle === cycleOf(now)) {
    let done = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt += 1) {
      const stored = await readCycle(s, patientRef, cycle);
      if (!stored) break;
      const value = stored.value;
      if (value.restored?.includes(orderId)) {
        done = true;
        outcome = 'restored';
        break;
      }
      try {
        await s.put<AllowanceCycle>(CONTAINERS.allowance, allowanceKey(patientRef, cycle), { ...value, consumed: Math.max(0, value.consumed - amount), restored: [...(value.restored ?? []), orderId] }, stored.version);
        done = true;
        outcome = 'restored';
      } catch (error) {
        if (statusOf(error) !== 409) throw error;
      }
    }
    if (!done && (await readCycle(s, patientRef, cycle))) throw new AllowanceContendedError();
  }
  if (outcome === 'unrecoverable') log.error('allowance', 'could not restore: the cycle has closed', { name: 'unrecoverable' });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await s.get<AllowanceLedgerEntry>(CONTAINERS.allowanceLedger, key);
    if (!current || current.value.restoredAt) break;
    try {
      await s.put<AllowanceLedgerEntry>(CONTAINERS.allowanceLedger, key, { ...current.value, restoredAt: now.toISOString(), outcome }, current.version);
      break;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  return { outcome, amount };
}

/**
 * Grants a cycle to a member: create-only, so granting the same member and cycle twice is the same result (the
 * second call changes nothing and returns `created: false`).
 */
export async function grantCycle(patientRef: string, cycle: string, monthly: number, currency = 'USD'): Promise<{ created: boolean }> {
  const s = await store();
  const value: AllowanceCycle = { patientRef, cycle, currency, granted: monthly, consumed: 0, lapsed: 0, monthly, drawdowns: {}, restored: [] };
  return { created: await s.createOnly(CONTAINERS.allowance, allowanceKey(patientRef, cycle), value) };
}

export interface ReloadResult {
  members: number;
  granted: number;
  lapsedCycles: number;
  lapsedCents: number;
}

/**
 * The scheduled reload (run monthly): for every member, grant the cycle `now` falls in (once) and forfeit what is
 * left of every earlier cycle (once). Run twice in a cycle: the second run changes nothing.
 */
export async function reloadAllowances(now: Date = new Date()): Promise<ReloadResult> {
  const s = await store();
  const target = cycleOf(now);
  const all = await s.query<AllowanceCycle>(CONTAINERS.allowance);
  const byMember = new Map<string, StoredObject<AllowanceCycle>[]>();
  for (const o of all) byMember.set(o.value.patientRef, [...(byMember.get(o.value.patientRef) ?? []), o]);
  const result: ReloadResult = { members: byMember.size, granted: 0, lapsedCycles: 0, lapsedCents: 0 };
  for (const [patientRef, cycles] of byMember) {
    const latest = [...cycles].sort((a, b) => b.value.cycle.localeCompare(a.value.cycle))[0]!;
    if (!cycles.some((c) => c.value.cycle === target) && latest.value.monthly > 0 && latest.value.cycle < target) {
      const { created } = await grantCycle(patientRef, target, latest.value.monthly, latest.value.currency);
      if (created) result.granted += 1;
    }
    for (const past of cycles.filter((c) => c.value.cycle < target)) {
      const lapsed = await lapse(s, patientRef, past.value.cycle);
      if (lapsed > 0) {
        result.lapsedCycles += 1;
        result.lapsedCents += lapsed;
      }
    }
  }
  return result;
}

/** Forfeits what is left of a closed cycle (versioned; a second call finds nothing left). Returns the cents lapsed now. */
async function lapse(s: AllowanceStore, patientRef: string, cycle: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await readCycle(s, patientRef, cycle);
    if (!stored) return 0;
    const left = balanceOf(stored.value);
    if (left === 0) return 0;
    try {
      await s.put<AllowanceCycle>(CONTAINERS.allowance, allowanceKey(patientRef, cycle), { ...stored.value, lapsed: stored.value.lapsed + left }, stored.version);
      return left;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  throw new AllowanceContendedError();
}
