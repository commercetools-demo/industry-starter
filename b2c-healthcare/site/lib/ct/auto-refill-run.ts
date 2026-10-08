import 'server-only';
import type { Order, RecurringOrder } from '@commercetools/platform-sdk';
import { ORDER_STATE_RECEIVED } from '@/lib/checkout/config';
import { apiRoot } from '@/lib/ct/client';
import { getUsedBySku, monthOf, periodCeilingFor } from '@/lib/ct/ceilings';
import { consumeAuthorization, DispenseRefusedError, type ConsumeLine } from '@/lib/ct/dispense-ledger';
import { nextOrderNumber } from '@/lib/ct/order-number';
import { getPatient } from '@/lib/ct/patient';
import { findOwnPrescription } from '@/lib/ct/prescriptions';
import { cancelRecurring, listActiveRecurring, paymentMethodOf, pauseRecurring, skipNextRecurring } from '@/lib/ct/recurring';
import { getRunLog, writeRunLog, type RefillLogEntry } from '@/lib/ct/refill-log';
import { getCatalogBySku } from '@/lib/ct/rx-catalog';
import { decideRun, type RunLine } from '@/lib/refill/decide-run';
import { log } from '@/lib/log';
import { isSkipping, expandedCart } from '@/lib/mappers/recurring';
import { rxFieldsOf } from '@/lib/mappers/cart';

/**
 * The scheduled check behind auto-refill (workstream T). The platform generates the orders of a Recurring Order on its
 * own schedule and the storefront has no API Extension to intercept one (D-028), so the gate runs AHEAD of the run:
 *
 *  1. `checkRuns`: for every Active recurring order whose next order is due within the look-ahead window, read the
 *     prescription as it will be on the day of the run (`decideRun`, N rules) and either let the run go ahead or
 *     skip it / pause / stop the series, recording the reason in `malva-refill-log`. A run is checked once
 *     (the log entry is the marker), a retry of the function never skips twice.
 *  2. `reconcileGenerated`: every order the platform generated from a recurring order in the last days is given what a
 *     storefront order has: the prescription is consumed once (`consumeAuthorization`, idempotent on the order id),
 *     an `MLV-` number and the state `mlv-received`.
 *
 * Failures are per recurring order: one broken one does not stop the others. Health-data rule: ids and counts only.
 */

export const DEFAULT_LOOKAHEAD_HOURS = 36;
/** Orders generated this long ago are still reconciled (a late run of the function must not lose one). */
export const RECONCILE_DAYS = 5;

export interface CheckSummary {
  /** Recurring orders looked at. */
  seen: number;
  notDue: number;
  alreadyChecked: number;
  allowed: number;
  skipped: number;
  paused: number;
  stopped: number;
  errors: number;
}

const emptySummary = (): CheckSummary => ({ seen: 0, notDue: 0, alreadyChecked: 0, allowed: 0, skipped: 0, paused: 0, stopped: 0, errors: 0 });

const isoDay = (iso: string): string => iso.slice(0, 10);

async function gatherLines(ro: RecurringOrder): Promise<{ lines: RunLine[]; hasPaymentMethod: boolean }> {
  const cart = expandedCart(ro);
  const items = (cart?.lineItems ?? []).map((item) => ({ item, fields: rxFieldsOf(item) }));
  const patient = ro.customer ? await getPatient(ro.customer.id) : null;
  const runFor = ro.nextOrderAt ?? '';
  const skus = items.map(({ item }) => item.variant?.sku ?? '').filter(Boolean);
  const currency = cart?.totalPrice?.currencyCode ?? 'USD';
  const country = cart?.country ?? 'US';
  const [catalog, used] = await Promise.all([
    getCatalogBySku(skus, { locale: 'en-US', currency, country }),
    patient ? getUsedBySku(patient.patientRef, monthOf(runFor)) : Promise.resolve(new Map<string, number>()),
  ]);
  const lines: RunLine[] = [];
  for (const { item, fields } of items) {
    const sku = item.variant?.sku ?? '';
    const rx = fields && patient ? await findOwnPrescription(patient.patientRef, fields.rxNumber) : null;
    const perOrderMax = catalog.get(sku)?.medication.maxQtyPerOrder ?? null;
    lines.push({
      lineRef: fields?.rxLineRef ?? item.id,
      qty: fields?.prescribedQty ?? 0,
      packs: item.quantity,
      rx: rx ? { refillsLeft: rx.refillsLeft, ...(rx.expiresAt ? { expiresAt: rx.expiresAt } : {}) } : null,
      perOrderMax,
      periodCeiling: periodCeilingFor(perOrderMax),
      usedInPeriod: used.get(sku) ?? 0,
    });
  }
  return { lines, hasPaymentMethod: paymentMethodOf(cart) !== null };
}

/** Phase 1. */
export async function checkRuns(now: Date = new Date(), lookaheadHours: number = DEFAULT_LOOKAHEAD_HOURS): Promise<CheckSummary> {
  const summary = emptySummary();
  const recurring = await listActiveRecurring();
  for (const ro of recurring) {
    summary.seen += 1;
    try {
      const runFor = ro.nextOrderAt;
      if (!runFor || Date.parse(runFor) - now.getTime() > lookaheadHours * 3_600_000) {
        summary.notDue += 1;
        continue;
      }
      // A skip that is set and not used yet, or a run that was already checked: nothing more to decide.
      if (isSkipping(ro) || (await getRunLog(ro.id, runFor))) {
        summary.alreadyChecked += 1;
        continue;
      }
      const { lines, hasPaymentMethod } = await gatherLines(ro);
      const decision = lines.length === 0 ? null : decideRun({ lines, today: isoDay(runFor), hasPaymentMethod });
      const entry: RefillLogEntry = { recurringOrderId: ro.id, runAt: now.toISOString(), runFor, outcome: 'allowed' };
      if (decision === null) {
        // A recurring cart with no prescription lines cannot be dispensed: pause it rather than let it run.
        await pauseRecurring(ro.id);
        await writeRunLog({ ...entry, outcome: 'skipped', reason: 'prescription-missing' });
        summary.paused += 1;
      } else if (decision.run) {
        await writeRunLog(entry);
        summary.allowed += 1;
      } else {
        if (decision.action === 'cancel') await cancelRecurring(ro.id, decision.reason);
        else if (decision.action === 'pause') await pauseRecurring(ro.id);
        else await skipNextRecurring(ro.id);
        await writeRunLog({ ...entry, outcome: decision.outcome, reason: decision.reason });
        if (decision.action === 'cancel') summary.stopped += 1;
        else if (decision.action === 'pause') summary.paused += 1;
        else summary.skipped += 1;
      }
    } catch (error) {
      summary.errors += 1;
      log.error('auto-refill', 'check failed', error instanceof Error ? error : { name: typeof error });
    }
  }
  return summary;
}

export interface ReconcileSummary {
  seen: number;
  consumed: number;
  numbered: number;
  refused: number;
  errors: number;
}

/** The consume lines of a generated order, from the prescription fields copied onto its lines. */
async function consumeLinesOf(order: Order): Promise<ConsumeLine[] | null> {
  if (!order.customerId) return null;
  const patient = await getPatient(order.customerId);
  if (!patient) return null;
  const items = order.lineItems.map((item) => ({ item, fields: rxFieldsOf(item) })).filter((x) => x.fields !== null);
  const catalog = await getCatalogBySku(items.map(({ item }) => item.variant?.sku ?? '').filter(Boolean), { locale: 'en-US', currency: order.totalPrice.currencyCode, country: order.country ?? 'US' });
  return items.map(({ item, fields }) => {
    const perOrderMax = catalog.get(item.variant?.sku ?? '')?.medication.maxQtyPerOrder ?? null;
    return {
      patientRef: patient.patientRef,
      rxNumber: fields!.rxNumber,
      lineRef: fields!.rxLineRef,
      sku: item.variant?.sku ?? '',
      qty: fields!.prescribedQty,
      packs: item.quantity,
      perOrderMax,
      periodCeiling: periodCeilingFor(perOrderMax),
    };
  });
}

/** Phase 2. */
export async function reconcileGenerated(now: Date = new Date()): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { seen: 0, consumed: 0, numbered: 0, refused: 0, errors: 0 };
  const since = new Date(now.getTime() - RECONCILE_DAYS * 86_400_000).toISOString();
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: 'recurringOrder(id is defined) and createdAt > :since', 'var.since': since, sort: 'createdAt desc', limit: 100 } })
    .execute();
  for (const order of body.results) {
    summary.seen += 1;
    try {
      const lines = await consumeLinesOf(order);
      if (lines && lines.length > 0) {
        const { alreadyConsumed } = await consumeAuthorization(order.id, lines, now);
        if (!alreadyConsumed) summary.consumed += 1;
      }
      if (!order.orderNumber) {
        await apiRoot
          .orders()
          .withId({ ID: order.id })
          .post({
            body: {
              version: order.version,
              actions: [
                { action: 'setOrderNumber', orderNumber: await nextOrderNumber() },
                { action: 'transitionState', state: { typeId: 'state', key: ORDER_STATE_RECEIVED }, force: true },
              ],
            },
          })
          .execute();
        summary.numbered += 1;
      }
    } catch (error) {
      if (error instanceof DispenseRefusedError) {
        // The prescription changed between the check and the run: the order exists and was paid; ops decide (see T-missed).
        summary.refused += 1;
        log.error('auto-refill', 'generated order refused by the dispense rules', { name: error.name });
      } else {
        summary.errors += 1;
        log.error('auto-refill', 'reconcile failed', error instanceof Error ? error : { name: typeof error });
      }
    }
  }
  return summary;
}

export interface RunSummary {
  checked: CheckSummary;
  reconciled: ReconcileSummary;
}

/** Both phases; each is attempted even if the other throws, and the first error is rethrown at the end (the function reports failure). */
export async function runAutoRefill(now: Date = new Date()): Promise<RunSummary> {
  let failure: unknown;
  let checked = emptySummary();
  let reconciled: ReconcileSummary = { seen: 0, consumed: 0, numbered: 0, refused: 0, errors: 0 };
  try {
    checked = await checkRuns(now);
  } catch (error) {
    failure = error;
  }
  try {
    reconciled = await reconcileGenerated(now);
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
  return { checked, reconciled };
}
