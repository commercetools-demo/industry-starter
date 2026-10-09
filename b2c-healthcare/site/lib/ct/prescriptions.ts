import 'server-only';
import type { Prescription, PrescriptionSource } from '@/lib/clinical/types';
import { getUsedBySku, monthOf, periodCeilingFor } from '@/lib/ct/ceilings';
import { prescriptionSource } from '@/lib/ct/clinical-store';
import { loadRxFixtures } from '@/lib/ct/fixtures';
import type { Patient } from '@/lib/ct/patient';
import { buildRxView, PACKS_PER_LINE, type LineContext } from '@/lib/ct/prescription-view';
import { checkCredentialDetailed } from '@/lib/ct/credentials';
import { getCatalogBySku, type CatalogOptions } from '@/lib/ct/rx-catalog';
import { getSupplyBySku } from '@/lib/ct/shelf-life';
import { normalizeRx } from '@/lib/dispense/rx-number';
import { todayIso } from '@/lib/dispense/rules';
import { recordOf, type CredentialRecord } from '@/lib/funding/credential';
import type { Money, RxLineView, RxQuickPick, RxView } from '@/lib/types';

/**
 * Prescription lookup and selection checks (workstream N). Health-data rule: the RX number, the medications and the
 * lookup input are never logged and never placed in a URL or cache key. Foreign and unknown numbers are the same
 * outcome (`null` / `RxNotFoundError`), so a caller cannot tell them apart.
 */

export type RxContext = CatalogOptions & { now?: Date };

export class RxNotFoundError extends Error {
  constructor() {
    super('prescription not found');
    this.name = 'RxNotFoundError';
  }
}

async function source(): Promise<PrescriptionSource> {
  const fixtures = await loadRxFixtures();
  return fixtures ? fixtures.fixturePrescriptionSource : prescriptionSource;
}

/** The signed-in patient's own prescriptions for quick-picks: numbers and dates only. */
export async function listOwnPrescriptions(patientRef: string): Promise<RxQuickPick[]> {
  const all = await (await source()).listForPatient(patientRef);
  return all.map((rx) => ({ number: rx.number, issuedAt: rx.issuedAt }));
}

/** A prescription by number, only when it belongs to the patient; unknown and foreign both return null. */
export async function findOwnPrescription(patientRef: string, number: string): Promise<Prescription | null> {
  const rx = await (await source()).getByNumber(number);
  return rx && rx.patientRef === patientRef ? rx : null;
}

async function usedBySku(patientRef: string, at: string): Promise<Map<string, number>> {
  if (await loadRxFixtures()) return new Map();
  return getUsedBySku(patientRef, monthOf(at));
}

async function supplyBySku(skus: string[]) {
  const fixtures = await loadRxFixtures();
  return fixtures ? fixtures.fixtureSupply(skus) : getSupplyBySku(skus);
}

/** Catalog, stock and this month's ledger for every SKU on the prescription (three reads, in parallel). */
async function contextsFor(rx: Prescription, ctx: RxContext, today: string): Promise<Map<string, LineContext>> {
  const skus = rx.lines.map((l) => l.sku);
  const [catalog, supply, used] = await Promise.all([getCatalogBySku(skus, ctx), supplyBySku(skus), usedBySku(rx.patientRef, today)]);
  const out = new Map<string, LineContext>();
  for (const sku of skus) {
    const entry = catalog.get(sku);
    if (!entry) continue;
    const max = entry.medication.maxQtyPerOrder;
    out.set(sku, {
      price: entry.medication.price,
      perOrderMax: max,
      periodCeiling: periodCeilingFor(max),
      minRemainingShelfLifeDays: entry.medication.minRemainingShelfLifeDays,
      shortDatedPrice: entry.shortDatedPrice,
      supply: supply.get(sku),
      usedInPeriod: used.get(sku) ?? 0,
      hsaEligible: entry.medication.hsaEligible,
      controlClass: entry.medication.controlClass,
    });
  }
  return out;
}

/**
 * Credentialed purchase scope (workstream U): a controlled row that could otherwise be bought needs a credential that is
 * valid today and covers its class. A row that cannot be bought for another reason keeps that reason. The row stays
 * visible with the requirement stated (`status: 'CREDENTIAL'`, `credential` says why); the credential that allowed a
 * row is returned per line ref so it can be copied onto the cart and order line.
 */
async function applyCredentials(patient: Patient, view: RxView, rx: Prescription, contexts: Map<string, LineContext>, now: Date): Promise<{ view: RxView; allowedBy: Map<string, CredentialRecord> }> {
  const allowedBy = new Map<string, CredentialRecord>();
  const byClass = new Map<string, Awaited<ReturnType<typeof checkCredentialDetailed>>>();
  const lines = await Promise.all(
    view.lines.map(async (row) => {
      const sku = rx.lines.find((l) => l.lineRef === row.lineRef)?.sku;
      const controlClass = sku ? contexts.get(sku)?.controlClass : null;
      if (!controlClass) return row;
      if (!byClass.has(controlClass)) byClass.set(controlClass, await checkCredentialDetailed(patient.patientRef, controlClass, now));
      const result = byClass.get(controlClass)!;
      if (result.code === 'OK') {
        if (result.credential) allowedBy.set(row.lineRef, recordOf(result.credential));
        return { ...row, controlClass };
      }
      return row.selectable ? { ...row, controlClass, status: 'CREDENTIAL' as const, selectable: false, credential: result.code } : { ...row, controlClass };
    }),
  );
  return { view: { ...view, lines }, allowedBy };
}

/** The card for a prescription the patient owns: every row evaluated against authorization, stock, ceilings, shelf life and credentials. */
export async function getRxView(patient: Patient, rx: Prescription, ctx: RxContext): Promise<RxView> {
  const today = todayIso(ctx.now);
  const contexts = await contextsFor(rx, ctx, today);
  return (await applyCredentials(patient, buildRxView(rx, patient.name, contexts, today), rx, contexts, ctx.now ?? new Date())).view;
}

/** Lookup by typed input. Null for malformed, unknown and foreign numbers alike. */
export async function lookupPrescription(patient: Patient, input: string, ctx: RxContext): Promise<RxView | null> {
  const number = normalizeRx(input);
  if (!number) return null;
  const rx = await findOwnPrescription(patient.patientRef, number);
  return rx ? getRxView(patient, rx, ctx) : null;
}

export interface SelectedLine {
  lineRef: string;
  sku: string;
  /** Units dispensed (prescribed quantity). */
  qty: number;
  packs: number;
  /** Catalog price per pack the row showed (informational; the platform cart is authoritative). */
  price: Money | null;
  /** Limits to carry into the cart check (O) and into `consumeAuthorization` (Q). */
  perOrderMax: number | null;
  periodCeiling: number | null;
  /** The product's `hsaEligible` (workstream U): copied to the cart line as `eligibleForRestricted` when added. */
  hsaEligible?: boolean;
  /** The credential that allowed a controlled product (id and expiry), copied to the cart line; absent for uncontrolled goods. */
  credential?: { id: string; validTo: string };
}

export interface RxSelectionResult {
  rxNumber: string;
  /** Rows that may be added. */
  accepted: SelectedLine[];
  /** Requested rows that cannot be dispensed (or are not on the prescription), with the reason and what remains. */
  refused: RxLineView[];
}

/**
 * The check behind "Add to cart" and the cart load (workstream O, `POST /api/cart/rx-lines`): the patient's own
 * prescription, the requested lines, each evaluated now. Nothing is consumed (consumption happens once, at order
 * placement, `consumeAuthorization`). Throws `RxNotFoundError` for unknown and foreign numbers.
 * Re-run it when the cart loads: a lowered ceiling or exhausted stock then shows up as a refused line.
 */
export async function validateRxSelection(patient: Patient, rxNumber: string, lineRefs: string[], ctx: RxContext): Promise<RxSelectionResult> {
  const number = normalizeRx(rxNumber);
  const rx = number ? await findOwnPrescription(patient.patientRef, number) : null;
  if (!rx) throw new RxNotFoundError();
  const today = todayIso(ctx.now);
  const contexts = await contextsFor(rx, ctx, today);
  const { view, allowedBy } = await applyCredentials(patient, buildRxView(rx, patient.name, contexts, today), rx, contexts, ctx.now ?? new Date());
  const accepted: SelectedLine[] = [];
  const refused: RxLineView[] = [];
  for (const ref of new Set(lineRefs)) {
    const row = view.lines.find((l) => l.lineRef === ref);
    const prescribed = rx.lines.find((l) => l.lineRef === ref);
    if (!row || !prescribed) {
      refused.push({ lineRef: ref, name: '', sig: '', qty: 0, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null });
      continue;
    }
    if (!row.selectable) {
      refused.push(row);
      continue;
    }
    const c = contexts.get(prescribed.sku);
    const credential = allowedBy.get(ref);
    accepted.push({
      lineRef: ref, sku: prescribed.sku, qty: prescribed.qty, packs: PACKS_PER_LINE, price: row.price, perOrderMax: c?.perOrderMax ?? null, periodCeiling: c?.periodCeiling ?? null,
      ...(c?.hsaEligible !== undefined ? { hsaEligible: c.hsaEligible } : {}),
      ...(credential ? { credential } : {}),
    });
  }
  return { rxNumber: rx.number, accepted, refused };
}
