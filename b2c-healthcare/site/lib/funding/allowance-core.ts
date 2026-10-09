import {
  allowanceKey,
  balanceOf,
  cycleOf,
  forfeitDate,
  type AllowanceCycle,
  type AllowanceLedgerEntry,
  type AllowanceView,
} from '@/lib/funding/allowance-types';

/**
 * Benefit allowance logic over a small store interface (benefit-allowance-drawdown). No server-only
 * import and no commercetools client: the storefront (`lib/ct/allowance.ts`, Custom Objects through the BFF client), the
 * reload script (`scripts/reload-allowances.ts`, the admin client) and the Netlify function all run this same code with
 * their own store. One Custom Object per member per monthly cycle, written only under optimistic concurrency
 * (`version`), like the prescription ledger (N):
 *
 *  - `drawdown(orderId)` is idempotent on the order id: the draw is recorded in the cycle object in the SAME versioned
 *    write that raises `consumed` (a crash or a retry can never draw twice), and an index entry keyed by the order id
 *    lets a cancel find the cycle again;
 *  - two orders racing for one balance cannot both take it: the second write fails with 409, re-reads and draws what is
 *    left (a part-payment, never more than the balance);
 *  - `restoreAllowance(orderId)` gives the amount back to the cycle it came from if that cycle is still the open one;
 *    otherwise it reports `unrecoverable` (the amount lapsed with its cycle);
 *  - `grantCycle` and `reloadAllowances` are idempotent per member per cycle: unspent balance is forfeited (`lapsed`),
 *    never carried over.
 * Nothing here pays out: an allowance is a number that only a drawdown on an order reduces. There is no withdraw or
 * transfer function, and no route for one.
 */

export const ALLOWANCE_CONTAINER = 'malva-allowance';
export const ALLOWANCE_LEDGER_CONTAINER = 'malva-allowance-ledger';

export interface StoredValue<T> {
  key: string;
  version: number;
  value: T;
}

/** Where the cycle objects live. `put` with a `version` fails with a 409 error when the stored version differs. */
export interface AllowanceStore {
  get<T>(container: string, key: string): Promise<StoredValue<T> | null>;
  put<T>(container: string, key: string, value: T, version?: number): Promise<StoredValue<T>>;
  createOnly<T>(container: string, key: string, value: T): Promise<boolean>;
  query<T>(container: string, where?: string): Promise<StoredValue<T>[]>;
}

const MAX_ATTEMPTS = 6;
const orderKey = (orderId: string) => orderId.replace(/[^-_~.a-zA-Z0-9]/g, '_');
const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: number; code?: number } | undefined;
  return x?.statusCode ?? x?.code;
};

export class AllowanceContendedError extends Error {
  constructor() {
    super('allowance is contended; try again');
    this.name = 'AllowanceContendedError';
  }
}

const readCycle = (s: AllowanceStore, patientRef: string, cycle: string) => s.get<AllowanceCycle>(ALLOWANCE_CONTAINER, allowanceKey(patientRef, cycle));

/** The member's allowance for the cycle `now` falls in, or null when none exists (the member has no allowance). */
export async function getAllowanceView(s: AllowanceStore, patientRef: string, now: Date): Promise<AllowanceView | null> {
  const cycle = cycleOf(now);
  const current = await readCycle(s, patientRef, cycle);
  if (!current) return null;
  const value = current.value;
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

export interface DrawdownResult {
  /** Cents drawn for this order (never more than the balance when it was drawn). */
  applied: number;
  /** True when this order had already drawn: nothing changed. */
  alreadyApplied: boolean;
  cycle: string | null;
}

async function indexDraw(s: AllowanceStore, patientRef: string, orderId: string, cycle: string, amount: number, now: Date): Promise<void> {
  const entry: AllowanceLedgerEntry = { orderId, patientRef, cycle, amount, at: now.toISOString() };
  await s.createOnly(ALLOWANCE_LEDGER_CONTAINER, orderKey(orderId), entry);
}

/**
 * Draws `min(amount, balance)` for the order from the current cycle. Idempotent on `orderId`. Returns `applied: 0`
 * when the member has no allowance or nothing is left (the whole amount then goes to the next tender).
 */
export async function drawdown(s: AllowanceStore, patientRef: string, orderId: string, amount: number, now: Date): Promise<DrawdownResult> {
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
      await s.put<AllowanceCycle>(ALLOWANCE_CONTAINER, allowanceKey(patientRef, cycle), { ...value, consumed: value.consumed + applied, drawdowns: { ...(value.drawdowns ?? {}), [orderId]: applied } }, stored.version);
    } catch (error) {
      if (statusOf(error) === 409) continue;
      throw error;
    }
    await indexDraw(s, patientRef, orderId, cycle, applied, now);
    return { applied, alreadyApplied: false, cycle };
  }
  throw new AllowanceContendedError();
}

export interface RestoreAllowanceResult {
  /** `none` = the order drew nothing (or was never seen); `already` = restored before. */
  outcome: 'restored' | 'unrecoverable' | 'none' | 'already';
  amount: number;
}

/**
 * Gives the order's draw back (cancel or return). Idempotent: a second call changes nothing. The amount goes back to
 * the cycle it came from only while that cycle is still the open one; once the cycle has closed its remainder was
 * forfeited and this reports `unrecoverable`.
 */
export async function restoreAllowance(s: AllowanceStore, orderId: string, now: Date): Promise<RestoreAllowanceResult> {
  const key = orderKey(orderId);
  const entry = await s.get<AllowanceLedgerEntry>(ALLOWANCE_LEDGER_CONTAINER, key);
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
        await s.put<AllowanceCycle>(ALLOWANCE_CONTAINER, allowanceKey(patientRef, cycle), { ...value, consumed: Math.max(0, value.consumed - amount), restored: [...(value.restored ?? []), orderId] }, stored.version);
        done = true;
        outcome = 'restored';
      } catch (error) {
        if (statusOf(error) !== 409) throw error;
      }
    }
    if (!done && (await readCycle(s, patientRef, cycle))) throw new AllowanceContendedError();
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await s.get<AllowanceLedgerEntry>(ALLOWANCE_LEDGER_CONTAINER, key);
    if (!current || current.value.restoredAt) break;
    try {
      await s.put<AllowanceLedgerEntry>(ALLOWANCE_LEDGER_CONTAINER, key, { ...current.value, restoredAt: now.toISOString(), outcome }, current.version);
      break;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  return { outcome, amount };
}

/**
 * Grants a cycle to a member: create-only, so granting the same member and cycle twice is the same result (the second
 * call changes nothing and returns `created: false`).
 */
export async function grantCycle(s: AllowanceStore, patientRef: string, cycle: string, monthly: number, currency = 'USD'): Promise<{ created: boolean }> {
  const value: AllowanceCycle = { patientRef, cycle, currency, granted: monthly, consumed: 0, lapsed: 0, monthly, drawdowns: {}, restored: [] };
  return { created: await s.createOnly(ALLOWANCE_CONTAINER, allowanceKey(patientRef, cycle), value) };
}

export interface ReloadResult {
  members: number;
  granted: number;
  lapsedCycles: number;
  lapsedCents: number;
}

/** Forfeits what is left of a closed cycle (versioned; a second call finds nothing left). Returns the cents lapsed now. */
async function lapse(s: AllowanceStore, patientRef: string, cycle: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await readCycle(s, patientRef, cycle);
    if (!stored) return 0;
    const left = balanceOf(stored.value);
    if (left === 0) return 0;
    try {
      await s.put<AllowanceCycle>(ALLOWANCE_CONTAINER, allowanceKey(patientRef, cycle), { ...stored.value, lapsed: stored.value.lapsed + left }, stored.version);
      return left;
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
    }
  }
  throw new AllowanceContendedError();
}

/**
 * The scheduled reload (run monthly): for every member, grant the cycle `now` falls in (once) and forfeit what is left
 * of every earlier cycle (once). Run twice in a cycle: the second run changes nothing.
 */
export async function reloadAllowances(s: AllowanceStore, now: Date): Promise<ReloadResult> {
  const target = cycleOf(now);
  const all = await s.query<AllowanceCycle>(ALLOWANCE_CONTAINER);
  const byMember = new Map<string, StoredValue<AllowanceCycle>[]>();
  for (const o of all) byMember.set(o.value.patientRef, [...(byMember.get(o.value.patientRef) ?? []), o]);
  const result: ReloadResult = { members: byMember.size, granted: 0, lapsedCycles: 0, lapsedCents: 0 };
  for (const [patientRef, cycles] of byMember) {
    const latest = [...cycles].sort((a, b) => b.value.cycle.localeCompare(a.value.cycle))[0]!;
    if (!cycles.some((c) => c.value.cycle === target) && latest.value.monthly > 0 && latest.value.cycle < target) {
      const { created } = await grantCycle(s, patientRef, target, latest.value.monthly, latest.value.currency);
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
