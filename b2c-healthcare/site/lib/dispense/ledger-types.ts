/**
 * Shapes of the dispense ledger (`malva-dispense-ledger`, one Custom Object per order id). Pure types.
 * The ledger holds quantities and references only: no sig, diagnosis or medication name (health-data-minimization).
 */

export interface LedgerLine {
  rxNumber: string;
  lineRef: string;
  sku: string;
  /** Units dispensed (the prescribed quantity of the line). */
  qty: number;
  /** Packs dispensed; the unit the ceilings count in. */
  packs: number;
}

export interface LedgerEntry {
  /** Order id; also the Custom Object key. */
  orderId: string;
  patientRef: string;
  /** Calendar month of the dispense (`2026-10`). */
  period: string;
  placedAt: string;
  lines: LedgerLine[];
  /** Set when the order was cancelled before shipping and its refills restored. */
  restoredAt?: string;
}
