import type { Prescription, PrescriptionLine } from '@/lib/clinical/types';

/**
 * What an order line keeps about the authorization it was supplied against (prescription-bound-supply, "Parameters
 * readable from the order"). The prescription may be amended or withdrawn later; the order must still say what was
 * supplied and on what basis, so the parameters are COPIED onto the line, not referenced.
 *
 * Health-data minimization: only references, quantities and dates. No sig, no diagnosis or condition, no
 * medication name (the line item already names the product). Used by the order workstream (Q) when it writes the
 * line item custom fields, and by `advance-order` (F-08) for `suppliedLots` at the `packed` step.
 */

/** One lot actually picked for the line; a line filled from several lots carries several of these (never one date for all). */
export interface SuppliedLot {
  lot: string;
  /** ISO date; absent for undated goods (nothing is recorded against them). */
  expiryDate?: string;
  qty: number;
}

/** The authorization as it stood when the order was placed. */
export interface AuthorizationParams {
  issuedAt: string;
  /** Absent = no expiry. */
  expiresAt?: string;
  /** Refills left on the prescription before this order consumed one. */
  refillsBefore: number;
}

export interface OrderLineRecord {
  rxNumber: string;
  rxLineRef: string;
  /** Units the prescription line authorizes per fill. */
  prescribedQty: number;
  /** Units actually dispensed on this order line. */
  dispensedQty: number;
  authorizationParams: AuthorizationParams;
  /** Empty until the warehouse picks (the `packed` step); the promise shown before ordering is never written here. */
  suppliedLots: SuppliedLot[];
}

/** Every field of the record; the test pins this list so a new field is a conscious, reviewed change. */
export const ORDER_LINE_RECORD_FIELDS = ['rxNumber', 'rxLineRef', 'prescribedQty', 'dispensedQty', 'authorizationParams', 'suppliedLots'] as const;
export const AUTHORIZATION_PARAMS_FIELDS = ['issuedAt', 'expiresAt', 'refillsBefore'] as const;
export const SUPPLIED_LOT_FIELDS = ['lot', 'expiryDate', 'qty'] as const;

/** The record for a line at order placement (before `consumeAuthorization` decrements the refill count). */
export function buildLineRecord(rx: Prescription, line: PrescriptionLine, dispensedQty: number = line.qty): OrderLineRecord {
  return {
    rxNumber: rx.number,
    rxLineRef: line.lineRef,
    prescribedQty: line.qty,
    dispensedQty,
    authorizationParams: { issuedAt: rx.issuedAt, ...(rx.expiresAt ? { expiresAt: rx.expiresAt } : {}), refillsBefore: rx.refillsLeft },
    suppliedLots: [],
  };
}

/** Records the lots picked for the line (replaces the list; the total must equal what was dispensed). */
export function withSuppliedLots(record: OrderLineRecord, lots: SuppliedLot[]): OrderLineRecord {
  const total = lots.reduce((sum, l) => sum + l.qty, 0);
  if (lots.length > 0 && total !== record.dispensedQty) throw new Error('supplied lots must add up to the dispensed quantity');
  return { ...record, suppliedLots: lots.map((l) => ({ lot: l.lot, qty: l.qty, ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}) })) };
}

/**
 * Flat values for the line item custom type (a custom type field cannot hold an object): numbers and strings, with
 * the nested parts as JSON strings. `suppliedLots` is a list, so mixed lots are kept separately.
 */
export function toLineCustomFields(record: OrderLineRecord): Record<string, string | number> {
  return {
    rxNumber: record.rxNumber,
    rxLineRef: record.rxLineRef,
    prescribedQty: record.prescribedQty,
    dispensedQty: record.dispensedQty,
    authorizationParams: JSON.stringify(record.authorizationParams),
    suppliedLots: JSON.stringify(record.suppliedLots),
  };
}

/** Reads the custom fields back; null when the line carries no prescription record (undated, non-Rx goods). */
export function fromLineCustomFields(fields: Record<string, unknown> | undefined): OrderLineRecord | null {
  if (!fields || typeof fields.rxNumber !== 'string') return null;
  const parse = <T,>(value: unknown, fallback: T): T => {
    try {
      return typeof value === 'string' ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    rxNumber: fields.rxNumber,
    rxLineRef: String(fields.rxLineRef ?? ''),
    prescribedQty: Number(fields.prescribedQty ?? 0),
    dispensedQty: Number(fields.dispensedQty ?? 0),
    authorizationParams: parse<AuthorizationParams>(fields.authorizationParams, { issuedAt: '', refillsBefore: 0 }),
    suppliedLots: parse<SuppliedLot[]>(fields.suppliedLots, []),
  };
}
