import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import { REASON } from '@/lib/ct/orders-reorder';
import { getRawOrderForCustomer } from '@/lib/ct/orders-read';
import type { Patient } from '@/lib/ct/patient';
import { RxNotFoundError, validateRxSelection, type RxContext, type SelectedLine } from '@/lib/ct/prescriptions';
import { addCadence, createRecurringFromLines, listRecurring, type RecurringLine } from '@/lib/ct/recurring';
import { lastRunsOf } from '@/lib/ct/refill-log';
import { expandedCart, mapRefill } from '@/lib/mappers/recurring';
import { rxFieldsOf } from '@/lib/mappers/cart';
import type { NotAddedReason } from '@/lib/order-types';
import type { Cadence, RefillView } from '@/lib/refill-types';

/**
 * Setting up auto-refill (workstream T). The source is either a past order of the customer or lines of one of the
 * patient's own prescriptions. Whatever the source, every line is re-validated NOW through N (`validateRxSelection`:
 * own prescription, refills, expiry, stock, ceilings, shelf life): only dispensable lines enter the standing order and
 * each other line is named with a reason. A saved payment method is required (the refill is charged to it).
 * Never recreates: a line that is already in an Active or Paused auto-refill is not added a second time.
 */

export type AutoRefillErrorCode = 'NO_PAYMENT_METHOD' | 'NOT_FOUND' | 'NOTHING_REFILLABLE' | 'NOT_DISPENSABLE' | 'ALREADY_ENABLED';

export class AutoRefillError extends Error {
  constructor(
    readonly code: AutoRefillErrorCode,
    readonly notIncluded: { name: string; reason: NotAddedReason }[] = [],
  ) {
    super(code);
    this.name = 'AutoRefillError';
  }
}

export type EnableSource = { orderId: string } | { rxNumber: string; lineRefs: string[] };

export interface EnableInput {
  customerId: string;
  patient: Patient;
  ctx: RxContext;
  source: EnableSource;
  cadence: Cadence;
  provider: Pick<PaymentProvider, 'listStoredMethods'>;
  now?: Date;
}

export interface EnableResult {
  refill: RefillView;
  /** Medicines that could not be included, named with the reason. */
  notIncluded: { name: string; reason: NotAddedReason }[];
}

interface Candidate {
  rxNumber: string;
  lineRef: string;
  name: string;
}

const nameOf = (name: Record<string, string>, locale: string): string => name[locale] ?? Object.values(name)[0] ?? '';

function candidatesFromOrder(order: Order, locale: string): Candidate[] {
  const out: Candidate[] = [];
  for (const item of order.lineItems) {
    const f = rxFieldsOf(item);
    if (f) out.push({ rxNumber: f.rxNumber, lineRef: f.rxLineRef, name: nameOf(item.name, locale) });
  }
  return out;
}

export async function enableAutoRefill(input: EnableInput): Promise<EnableResult> {
  const { customerId, patient, ctx, source, cadence } = input;
  const now = input.now ?? new Date();

  // 1. a saved payment method (the default, else the first)
  const methods = await input.provider.listStoredMethods(customerId);
  const method = methods.find((m) => m.isDefault) ?? methods[0];
  if (!method) throw new AutoRefillError('NO_PAYMENT_METHOD');

  // 2. candidates
  let candidates: Candidate[];
  if ('orderId' in source) {
    const order = await getRawOrderForCustomer(source.orderId, customerId);
    if (!order) throw new AutoRefillError('NOT_FOUND');
    candidates = candidatesFromOrder(order, ctx.locale);
  } else {
    candidates = source.lineRefs.map((lineRef) => ({ rxNumber: source.rxNumber, lineRef, name: '' }));
  }
  if (candidates.length === 0) throw new AutoRefillError('NOTHING_REFILLABLE');

  // 3. not twice: lines already in an Active or Paused auto-refill
  const existing = (await listRecurring(customerId)).filter((r) => r.recurringOrderState === 'Active' || r.recurringOrderState === 'Paused');
  const taken = new Set(existing.flatMap((r) => (expandedCart(r)?.lineItems ?? []).map((i) => rxFieldsOf(i)).filter((f) => f !== null).map((f) => `${f.rxNumber}|${f.rxLineRef}`)));
  const fresh = candidates.filter((c) => !taken.has(`${c.rxNumber}|${c.lineRef}`));
  if (fresh.length === 0) throw new AutoRefillError('ALREADY_ENABLED');

  // 4. dispensable now?
  const groups = new Map<string, Candidate[]>();
  for (const c of fresh) groups.set(c.rxNumber, [...(groups.get(c.rxNumber) ?? []), c]);
  const lines: RecurringLine[] = [];
  const notIncluded: EnableResult['notIncluded'] = [];
  for (const [rxNumber, group] of groups) {
    let selection;
    try {
      selection = await validateRxSelection(patient, rxNumber, group.map((g) => g.lineRef), ctx);
    } catch (error) {
      if (!(error instanceof RxNotFoundError)) throw error;
      if ('orderId' in source) for (const g of group) notIncluded.push({ name: g.name, reason: 'UNAVAILABLE' });
      else throw new AutoRefillError('NOT_FOUND');
      continue;
    }
    const nameOfRef = (ref: string, fallback: string) => group.find((g) => g.lineRef === ref)?.name || fallback;
    for (const row of selection.refused) notIncluded.push({ name: nameOfRef(row.lineRef, row.name), reason: REASON[row.status] ?? 'UNAVAILABLE' });
    for (const a of selection.accepted as SelectedLine[]) lines.push({ sku: a.sku, rxNumber, rxLineRef: a.lineRef, prescribedQty: a.qty });
  }
  if (lines.length === 0) throw new AutoRefillError('NOT_DISPENSABLE', notIncluded);

  // 5. the standing order (refills ship standard: the same-day cut-off means nothing on a schedule)
  const ro = await createRecurringFromLines({
    customerId,
    currency: ctx.currency,
    country: ctx.country,
    shippingMethodKey: 'mlv-standard',
    lines,
    cadence,
    startsAt: addCadence(now, cadence),
    paymentMethodId: method.id,
  });
  return { refill: mapRefill(ro, ctx.locale), notIncluded };
}

/** The customer's auto-refills with the last scheduled check of each (a failed log read leaves the line out, never the page). */
export async function listRefills(customerId: string, locale: string): Promise<RefillView[]> {
  const all = await listRecurring(customerId);
  const runs = await lastRunsOf(all.map((r) => r.id)).catch(() => new Map());
  return all.map((r) => mapRefill(r, locale, runs.get(r.id) ?? null));
}
