import 'server-only';
import type { RecurringOrder } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { ORDER_EXPAND } from '@/lib/ct/orders';
import { getRecurrencePolicies } from '@/lib/ct/product-detail';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { mapRecurringOrder, pendingFrom } from '@/lib/mappers/recurring-order';
import { SubscriptionRejected, UUID, planAction } from '@/lib/ct/subscription-plan';
import type { PendingSubscription, Subscription, SubscriptionAction } from '@/lib/types';

/**
 * Recurring orders of the signed-in customer (workstream N). Created by the platform when an order with recurring lines is
 * placed (documented "Create Order from Cart"); we only read and update. Scope `manage_recurring_orders` (OA-02).
 * Never cached: a recurring order changes in the platform (renewals, failures). Every read is scoped by a predicate
 * variable; a recurring order of another customer is `not_found`, the same as an unknown id.
 */
const EXPAND = ['cart', 'originOrder'];
const PAGE = 50;
const PENDING_ORDERS = 10;

const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number } | null)?.statusCode;

export async function listRecurringOrders(customerId: string): Promise<RecurringOrder[]> {
  const { body } = await apiRoot
    .recurringOrders()
    .get({
      queryArgs: { where: 'customer(id=:customerId)', 'var.customerId': customerId, expand: EXPAND, sort: ['createdAt desc'], limit: PAGE },
    })
    .execute();
  return body.results;
}

async function readOwned(customerId: string, id: string): Promise<RecurringOrder> {
  if (!UUID.test(id)) throw new AppError('not_found', 404);
  let raw: RecurringOrder;
  try {
    raw = (await apiRoot.recurringOrders().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) throw new AppError('not_found', 404);
    throw e;
  }
  // Unknown and foreign are indistinguishable.
  if (raw.customer?.id !== customerId) throw new AppError('not_found', 404);
  return raw;
}

export async function getRecurringOrder(customerId: string, id: string, locale: string): Promise<Subscription> {
  return mapRecurringOrder(await readOwned(customerId, id), locale);
}

/** Orders of the customer that hold recurring lines but are not the origin of any listed recurring order. */
export async function listPendingSubscriptions(customerId: string, subscriptions: Pick<Subscription, 'originOrderId'>[], locale: string): Promise<PendingSubscription[]> {
  const { body } = await apiRoot
    .orders()
    .get({
      queryArgs: { where: 'customerId=:customerId', 'var.customerId': customerId, expand: ORDER_EXPAND, sort: ['createdAt desc'], limit: PENDING_ORDERS },
    })
    .execute();
  return pendingFrom(body.results, subscriptions, locale);
}

/**
 * Read, check ownership and state, write one action with the version just read; one retry on a 409
 * (`updateWithRetry`), a second conflict is `conflict` (the route answers `version_conflict`).
 */
export async function applyRecurringAction(customerId: string, id: string, req: SubscriptionAction, locale: string): Promise<Subscription> {
  if (req.action === 'setInterval') {
    const policies = await getRecurrencePolicies(locale);
    if (!policies.some((p) => p.id === req.recurrencePolicyId)) throw new SubscriptionRejected('subscription_unavailable', 422);
  }
  try {
    const updated = await updateWithRetry(
      () => readOwned(customerId, id),
      async (current) => {
        const action = planAction(current, req);
        return (
          await apiRoot
            .recurringOrders()
            .withId({ ID: id })
            .post({ body: { version: current.version, actions: [action] }, queryArgs: { expand: EXPAND } })
            .execute()
        ).body;
      },
    );
    return mapRecurringOrder(updated, locale);
  } catch (e) {
    // A recurring order that is processing an order refuses updates (InvalidOperation, 400).
    if (statusOf(e) === 400) throw new SubscriptionRejected('invalid_state', 422);
    throw e;
  }
}
