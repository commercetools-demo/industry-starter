import 'server-only';
import { CONTAINERS, createOnly, getObject, putObject, statusOf } from '@/lib/ct/custom-objects';
import { checkLineCeiling } from '@/lib/ct/ceilings';
import type { Prescription } from '@/lib/clinical/types';
import type { LedgerEntry, LedgerLine } from '@/lib/dispense/ledger-types';
import { checkAuthorization, isRefusal, periodOf, todayIso, type Refusal } from '@/lib/dispense/rules';

/**
 * Consumption ledger for prescription-bound supply. The authorization stays in the clinical stand-in (`malva-rx`);
 * what commerce owns is who consumed how much and when.
 *
 * Idempotency on the order id works in two layers:
 *  1. each prescription records the order ids that consumed a refill (`consumedBy`) in the SAME versioned write as
 *     the decrement, so a retry (or a crash between two prescriptions) can never decrement twice;
 *  2. the ledger entry (key = order id, created with `version: 0`) is written last and its existence means "done":
 *     a second call is a no-op.
 * Nothing is consumed before order placement; carts that are abandoned never reach this module.
 */

const MAX_ATTEMPTS = 6;
const keyOf = (orderId: string) => orderId.replace(/[^-_~.a-zA-Z0-9]/g, '_');

export interface ConsumeLine {
  patientRef: string;
  rxNumber: string;
  lineRef: string;
  sku: string;
  /** Units dispensed; must equal the prescribed quantity of the line (no partial supply). */
  qty: number;
  packs: number;
  /** Calendar-month ceiling re-checked at order creation (a lowered ceiling must not be escaped by an old cart). */
  periodCeiling: number | null;
  perOrderMax: number | null;
}

/** The supply was refused; `refusal` has the reason and what remains. Nothing was consumed. */
export class DispenseRefusedError extends Error {
  readonly refusal: Refusal;
  readonly lineRef?: string;
  constructor(refusal: Refusal, lineRef?: string) {
    super(`dispense refused: ${refusal.reason}`);
    this.name = 'DispenseRefusedError';
    this.refusal = refusal;
    this.lineRef = lineRef;
  }
}

export class ConcurrencyExhaustedError extends Error {
  constructor() {
    super('prescription is contended; try again');
    this.name = 'ConcurrencyExhaustedError';
  }
}

export interface ConsumeResult {
  /** True when the order had already been consumed (a retry): nothing was changed. */
  alreadyConsumed: boolean;
}

function validate(rx: Prescription | undefined, lines: ConsumeLine[], today: string, orderId: string): void {
  const first = lines[0];
  if (!rx || rx.patientRef !== first.patientRef) throw new DispenseRefusedError({ reason: 'NO_REFILLS', remaining: 0 }, first.lineRef);
  const alreadyApplied = rx.consumedBy?.includes(orderId) === true;
  for (const line of lines) {
    const rxLine = rx.lines.find((l) => l.lineRef === line.lineRef && l.sku === line.sku);
    if (!rxLine || rxLine.qty !== line.qty) throw new DispenseRefusedError({ reason: 'NO_REFILLS', remaining: 0 }, line.lineRef);
    if (alreadyApplied) continue;
    const check = checkAuthorization({ refillsLeft: rx.refillsLeft, expiresAt: rx.expiresAt, lineQty: rxLine.qty, requestedQty: line.qty, today });
    if (isRefusal(check)) throw new DispenseRefusedError(check, line.lineRef);
  }
}

/**
 * Consumes one refill per prescription touched by the order (a fill = one order against a prescription) and
 * records the order in the ledger. Idempotent on `orderId`. Refuses (nothing consumed) when a prescription is
 * expired or exhausted or a ceiling would be exceeded.
 */
export async function consumeAuthorization(orderId: string, lines: ConsumeLine[], now: Date = new Date()): Promise<ConsumeResult> {
  if (lines.length === 0) return { alreadyConsumed: false };
  const ledgerKey = keyOf(orderId);
  if (await getObject<LedgerEntry>(CONTAINERS.dispenseLedger, ledgerKey)) return { alreadyConsumed: true };

  const today = todayIso(now);
  const byRx = new Map<string, ConsumeLine[]>();
  for (const line of lines) byRx.set(line.rxNumber, [...(byRx.get(line.rxNumber) ?? []), line]);

  // 1. Validate everything before consuming anything.
  for (const [rxNumber, rxLines] of byRx) {
    validate((await getObject<Prescription>(CONTAINERS.rx, rxNumber))?.value, rxLines, today, orderId);
  }
  for (const line of lines) {
    const ceiling = await checkLineCeiling({ patientRef: line.patientRef, sku: line.sku, packs: line.packs, perOrderMax: line.perOrderMax, periodCeiling: line.periodCeiling, at: today });
    if (isRefusal(ceiling)) throw new DispenseRefusedError(ceiling, line.lineRef);
  }

  // 2. Decrement each prescription with optimistic concurrency; a 409 re-reads and re-validates.
  for (const [rxNumber, rxLines] of byRx) {
    let done = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt += 1) {
      const stored = await getObject<Prescription>(CONTAINERS.rx, rxNumber);
      validate(stored?.value, rxLines, today, orderId);
      const rx = stored!.value;
      if (rx.consumedBy?.includes(orderId)) {
        done = true;
        break;
      }
      try {
        await putObject<Prescription>(CONTAINERS.rx, rxNumber, { ...rx, refillsLeft: rx.refillsLeft - 1, consumedBy: [...(rx.consumedBy ?? []), orderId] }, stored!.version);
        done = true;
      } catch (e) {
        if (statusOf(e) !== 409) throw e;
      }
    }
    if (!done) throw new ConcurrencyExhaustedError();
  }

  // 3. The ledger entry is written last; if it already exists a concurrent retry finished first.
  const entry: LedgerEntry = {
    orderId,
    patientRef: lines[0].patientRef,
    period: periodOf(today),
    placedAt: now.toISOString(),
    lines: lines.map(({ rxNumber, lineRef, sku, qty, packs }): LedgerLine => ({ rxNumber, lineRef, sku, qty, packs })),
  };
  const created = await createOnly(CONTAINERS.dispenseLedger, ledgerKey, entry);
  return { alreadyConsumed: !created };
}

export interface RestoreResult {
  restored: boolean;
}

/**
 * Cancellation before `mlv-packed-shipped` restores the refills the order consumed. Idempotent:
 * an unknown order, or one already restored, is a no-op.
 */
export async function restoreAuthorization(orderId: string, now: Date = new Date()): Promise<RestoreResult> {
  const ledgerKey = keyOf(orderId);
  const ledger = await getObject<LedgerEntry>(CONTAINERS.dispenseLedger, ledgerKey);
  if (!ledger || ledger.value.restoredAt) return { restored: false };

  for (const rxNumber of new Set(ledger.value.lines.map((l) => l.rxNumber))) {
    let done = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt += 1) {
      const stored = await getObject<Prescription>(CONTAINERS.rx, rxNumber);
      if (!stored || !stored.value.consumedBy?.includes(orderId)) {
        done = true;
        break;
      }
      const rx = stored.value;
      try {
        await putObject<Prescription>(CONTAINERS.rx, rxNumber, { ...rx, refillsLeft: rx.refillsLeft + 1, consumedBy: (rx.consumedBy ?? []).filter((id) => id !== orderId) }, stored.version);
        done = true;
      } catch (e) {
        if (statusOf(e) !== 409) throw e;
      }
    }
    if (!done) throw new ConcurrencyExhaustedError();
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await getObject<LedgerEntry>(CONTAINERS.dispenseLedger, ledgerKey);
    if (!current || current.value.restoredAt) return { restored: true };
    try {
      await putObject<LedgerEntry>(CONTAINERS.dispenseLedger, ledgerKey, { ...current.value, restoredAt: now.toISOString() }, current.version);
      return { restored: true };
    } catch (e) {
      if (statusOf(e) !== 409) throw e;
    }
  }
  throw new ConcurrencyExhaustedError();
}
