import 'server-only';
import type { Prescription, PrescriptionLine } from '@/lib/clinical/types';
import { assessShelfLife, type Supply } from '@/lib/ct/shelf-life';
import { checkAuthorization, checkCeiling, checkStock, isRefusal, shelfLifeMonths, type Refusal } from '@/lib/dispense/rules';
import type { Money, RxLineView, RxView } from '@/lib/types';

/** What the catalog and stock say about one prescribed SKU. Missing entirely = not sold. */
export interface LineContext {
  price: Money | null;
  /** Per-order limit (`maxQtyPerOrder`, mirrored as the native inventory limit). */
  perOrderMax: number | null;
  /** Per-patient calendar-month ceiling. */
  periodCeiling: number | null;
  minRemainingShelfLifeDays: number | null;
  /** Price on the `mlv-short-dated` channel, when the variant has one. */
  shortDatedPrice: Money | null;
  supply: Supply | undefined;
  /** Packs the patient already received this calendar month. */
  usedInPeriod: number;
}

/** Packs per prescription line in v1: the prescribed quantity is one pack (qty equals the pack size in the catalog). */
export const PACKS_PER_LINE = 1;

const refused = (line: PrescriptionLine, base: Pick<RxLineView, 'price' | 'minShelfLifeMonths'>, r: Refusal): RxLineView => ({
  lineRef: line.lineRef,
  name: line.name,
  sig: line.sig,
  qty: line.qty,
  price: base.price,
  minShelfLifeMonths: base.minShelfLifeMonths,
  status: r.reason,
  selectable: false,
  remaining: Number.isFinite(r.remaining) ? r.remaining : undefined,
  ...(r.ceiling !== undefined ? { ceiling: r.ceiling } : {}),
  ...(r.scope ? { scope: r.scope } : {}),
  ...(r.expiryDate ? { expiryDate: r.expiryDate } : {}),
});

/**
 * One row of the card. Rules in the order the patient can act on them: authorization (expiry before exhaustion),
 * stock, ceilings, shelf life. A row that cannot be dispensed is returned with its reason and `selectable: false`.
 */
export function evaluateLine(rx: Prescription, line: PrescriptionLine, ctx: LineContext | undefined, today: string): RxLineView {
  const base = { price: ctx?.price ?? null, minShelfLifeMonths: ctx?.supply?.expiryDate ? shelfLifeMonths(ctx.minRemainingShelfLifeDays) : null };

  const auth = checkAuthorization({ refillsLeft: rx.refillsLeft, expiresAt: rx.expiresAt, lineQty: line.qty, today });
  if (isRefusal(auth)) return refused(line, base, auth);

  if (!ctx || !ctx.supply) return refused(line, base, { reason: 'OUT_OF_STOCK', remaining: 0 });
  const stock = checkStock({ available: ctx.supply.available, requested: PACKS_PER_LINE });
  if (isRefusal(stock)) return refused(line, base, stock);

  const ceiling = checkCeiling({ requested: PACKS_PER_LINE, perOrderMax: ctx.perOrderMax, periodCeiling: ctx.periodCeiling, usedInPeriod: ctx.usedInPeriod });
  if (isRefusal(ceiling)) return refused(line, base, ceiling);

  const shelf = assessShelfLife({ minRemainingShelfLifeDays: ctx.minRemainingShelfLifeDays, expiryDate: ctx.supply.expiryDate, today, shortDatedPrice: ctx.shortDatedPrice });
  if (shelf.status === 'excluded') return refused(line, base, shelf.refusal);
  const common = { lineRef: line.lineRef, name: line.name, sig: line.sig, qty: line.qty, selectable: true, minShelfLifeMonths: base.minShelfLifeMonths };
  if (shelf.status === 'short-dated') return { ...common, price: shelf.price, status: 'short-dated', expiryDate: shelf.expiryDate };
  return { ...common, price: base.price, status: 'ok' };
}

export function buildRxView(rx: Prescription, patientName: string, contexts: Map<string, LineContext>, today: string): RxView {
  return {
    number: rx.number,
    prescriber: rx.prescriber,
    issuedAt: rx.issuedAt,
    refillsLeft: rx.refillsLeft,
    patientName,
    lines: rx.lines.map((line) => evaluateLine(rx, line, contexts.get(line.sku), today)),
  };
}
