// Subscriptions of the store (workstream V-07, V-08): the RecurringOrders of the store and the Admin actions pause, resume, cancel and
// skip next. Recurring orders have no in-store endpoint (OAS `api-RecurringOrder` has the project path only), so every read and write
// is scoped by `store(key=...)` in the predicate, and an id of another store is "not found". Update action names confirmed in the OAS:
// `setRecurringOrderState` (`recurringOrderState: { type: 'paused' | 'active' | 'canceled' }`) and `setOrderSkipConfiguration`
// (`skipConfigurationInputDraft: { type: 'Counter', totalToSkip }`).
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import { actionTarget, mapSubscription, summarize, type RecurringOrderInput } from '@/lib/subscriptions/model';
import type { SubscriptionAction, SubscriptionAuditEntry, SubscriptionList } from '@/lib/v-types';
import { V_CONTAINERS, createObject, listObjects } from './v-objects';
import { vRoot } from './v-root';
import { retryOnConflict, statusOf } from './versioned';

export const clean = (value: string): string => value.replace(/["\\]/g, '');

interface Recurring extends RecurringOrderInput {
  version: number;
}

export async function listRecurringOrders(storeKey: string): Promise<Recurring[]> {
  const root = await vRoot();
  const { body } = await root
    .recurringOrders()
    .get({ queryArgs: { where: `store(key="${clean(storeKey)}")`, expand: ['cart', 'customer'], limit: 100, sort: 'nextOrderAt asc', withTotal: true } })
    .execute();
  return body.results as unknown as Recurring[];
}

export async function listSubscriptions(storeKey: string, locale = 'en-US', now: Date = new Date()): Promise<SubscriptionList> {
  return summarize((await listRecurringOrders(storeKey)).map((r) => mapSubscription(r, locale)), now);
}

async function loadOwn(storeKey: string, id: string): Promise<Recurring> {
  const root = await vRoot();
  const { body } = await root
    .recurringOrders()
    .get({ queryArgs: { where: `id="${clean(id)}" and store(key="${clean(storeKey)}")`, expand: ['cart', 'customer'], limit: 1 } })
    .execute();
  const found = body.results[0] as unknown as Recurring | undefined;
  if (!found) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
  return found;
}

const BODIES: Record<SubscriptionAction, unknown> = {
  pause: { action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } },
  resume: { action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } },
  cancel: { action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'Canceled by the store' } },
  skip: { action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 } },
};

/**
 * One management action. The target state comes from the action word only (never from the client); a version conflict is retried once
 * with a fresh read, and one audit record is written after the update (D8).
 */
export async function runSubscriptionAction(storeKey: string, id: string, action: SubscriptionAction, actorId: string, now: Date = new Date()): Promise<{ status: string }> {
  const root = await vRoot();
  let from = '';
  let to = '';
  try {
    await retryOnConflict(async () => {
      const current = await loadOwn(storeKey, id);
      from = current.recurringOrderState;
      const target = actionTarget(from, action);
      if (target === null) throw new CatalogError(409, action === 'skip' ? 'NOT_ACTIVE' : 'INVALID_TRANSITION', action === 'skip' ? 'Only an active subscription can skip a renewal' : `A ${from} subscription cannot be changed this way`);
      if (action === 'skip' && mapSubscription(current).skipsRemaining > 0) throw new CatalogError(409, 'SKIP_PENDING', 'The next renewal is already skipped');
      to = target;
      await root.recurringOrders().withId({ ID: current.id }).post({ body: { version: current.version, actions: [BODIES[action] as never] } }).execute();
    }, 2);
  } catch (error) {
    // "A Recurring Order can only be updated when it is not processing an Order": InvalidOperation.
    if (statusOf(error) === 400) throw new CatalogError(409, 'BUSY', 'The subscription is processing an order, try again in a moment');
    throw error;
  }
  const existing = await listObjects<{ storeKey: string }>(V_CONTAINERS.audit, `value(recurringOrderId="${clean(id)}")`);
  const base = existing.filter((o) => o.value.storeKey === storeKey).length;
  const entry: SubscriptionAuditEntry & { storeKey: string; recurringOrderId: string } = { storeKey, recurringOrderId: id, action, by: actorId, at: now.toISOString(), from, to };
  await createObject(V_CONTAINERS.audit, (n) => `${storeKey}--${id}--${base + n}`, entry);
  return { status: to };
}

export async function listAudit(storeKey: string, id: string): Promise<SubscriptionAuditEntry[]> {
  await loadOwn(storeKey, id);
  const rows = await listObjects<SubscriptionAuditEntry & { storeKey: string }>(V_CONTAINERS.audit, `value(recurringOrderId="${clean(id)}")`);
  return rows
    .filter((o) => o.value.storeKey === storeKey)
    .map(({ value: v }) => ({ action: v.action, by: v.by, at: v.at, from: v.from, to: v.to }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
