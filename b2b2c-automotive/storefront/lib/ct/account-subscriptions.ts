// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The shopper's subscriptions = their commercetools Recurring Orders (workstream Q-12, D10, owner answer Q-Q06). The API has no in-store
// endpoint for them (`plans/notes/V-names.md`): every read and write is scoped by `customer(id=...)` and `store(key=...)` in the predicate, and
// an order is fetched with both before it is changed. Actions (verified against the OAS `api-RecurringOrder`, see the workstream notes):
//   skip              setOrderSkipConfiguration { skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 } }
//   pause/resume/cancel  setRecurringOrderState { recurringOrderState: { type: 'paused' | 'active' | 'canceled' } }
//   change-frequency  setSchedule { recurrencePolicy: { typeId: 'recurrence-policy', key } }
import 'server-only';
import type { RecurrencePolicy, RecurringOrder, RecurringOrderUpdateAction } from '@commercetools/platform-sdk';
import { AccountError, errorCodes, safeId, statusOf } from '@/lib/account/errors';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';
import { mapSubscription, type PolicyDetail } from '@/lib/mappers/account';
import { POLICY_KEY_PREFIX, subscriptionsPurchaseEnabled } from '@/lib/subscriptions/config';
import type { SubscriptionAction, SubscriptionView } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const EXPAND = ['originOrder'];

function scope(storeKey: string, customerId: string): string {
  if (!KEY_PATTERN.test(storeKey)) throw new AccountError('not-found', 404);
  return `customer(id="${safeId(customerId)}") and store(key="${storeKey}")`;
}

async function policyDetails(locale: string): Promise<PolicyDetail[]> {
  const { body } = await apiRoot.recurrencePolicies().get({ queryArgs: { limit: 50 } }).execute();
  return body.results.filter((p: RecurrencePolicy) => p.key.startsWith(POLICY_KEY_PREFIX)).map((p) => ({ id: p.id, key: p.key, label: getLocalizedString(p.name, locale) || p.key, schedule: p.schedule }));
}

export async function listSubscriptions(storeKey: string, customerId: string, locale: string): Promise<SubscriptionView[]> {
  const [{ body }, policies] = await Promise.all([
    apiRoot.recurringOrders().get({ queryArgs: { where: scope(storeKey, customerId), expand: EXPAND, sort: 'createdAt desc', limit: 50 } }).execute(),
    policyDetails(locale),
  ]);
  return body.results.map((ro) => mapSubscription(ro, policies, locale));
}

/** Purchasable (`SUBSCRIPTIONS_PURCHASE_ENABLED` is not `false`) or the customer already has a recurring order (D10). */
export async function subscriptionsOffered(storeKey: string, customerId: string): Promise<boolean> {
  if (subscriptionsPurchaseEnabled()) return true;
  const { body } = await apiRoot.recurringOrders().get({ queryArgs: { where: scope(storeKey, customerId), limit: 1 } }).execute();
  return body.results.length > 0;
}

async function loadOwn(storeKey: string, customerId: string, id: string): Promise<RecurringOrder> {
  const { body } = await apiRoot
    .recurringOrders()
    .get({ queryArgs: { where: `id="${safeId(id)}" and ${scope(storeKey, customerId)}`, expand: EXPAND, limit: 1 } })
    .execute();
  const found = body.results[0];
  if (!found) throw new AccountError('not-found', 404);
  return found;
}

export interface SubscriptionCommand {
  action: SubscriptionAction;
  policyKey?: string;
}

const ALLOWED_FROM: Record<Exclude<SubscriptionAction, 'change-frequency'>, RecurringOrder['recurringOrderState'][]> = {
  skip: ['Active'],
  pause: ['Active'],
  resume: ['Paused', 'Failed'],
  cancel: ['Active', 'Paused', 'Failed'],
};

/** Runs one action on the shopper's own recurring order and returns it as the API now has it (the displayed next date is the API's). */
export async function runSubscriptionAction(storeKey: string, customerId: string, id: string, command: SubscriptionCommand, locale: string): Promise<SubscriptionView> {
  const current = await loadOwn(storeKey, customerId, id);
  const policies = await policyDetails(locale);
  let action: RecurringOrderUpdateAction;
  if (command.action === 'change-frequency') {
    const policy = policies.find((p) => p.key === command.policyKey);
    if (!policy) throw new AccountError('unknown-policy');
    if (current.recurringOrderState === 'Canceled' || current.recurringOrderState === 'Expired') throw new AccountError('not-active', 409);
    action = { action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', key: policy.key } };
  } else {
    if (!ALLOWED_FROM[command.action].includes(current.recurringOrderState)) throw new AccountError('not-active', 409);
    const view = mapSubscription(current, policies, locale);
    if (command.action === 'skip') {
      if (view.skipPending > 0) throw new AccountError('skip-pending', 409);
      action = { action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 } };
    } else {
      const type = command.action === 'pause' ? 'paused' : command.action === 'resume' ? 'active' : 'canceled';
      action = { action: 'setRecurringOrderState', recurringOrderState: { type } };
    }
  }
  try {
    const { body } = await apiRoot.recurringOrders().withId({ ID: current.id }).post({ queryArgs: { expand: EXPAND }, body: { version: current.version, actions: [action] } }).execute();
    return mapSubscription(body, policies, locale);
  } catch (error) {
    // Updates fail with InvalidOperation while commercetools is creating the next order, and with 409 on a version conflict.
    if (statusOf(error) === 409 || errorCodes(error).includes('InvalidOperation')) throw new AccountError('busy', 409);
    throw error;
  }
}

/** Cancels every active, paused or failed recurring order of the customer (delete account). Best effort per order; an order already busy is skipped. */
export async function cancelAllSubscriptions(storeKey: string, customerId: string): Promise<void> {
  const { body } = await apiRoot.recurringOrders().get({ queryArgs: { where: scope(storeKey, customerId), limit: 50 } }).execute();
  for (const ro of body.results) {
    if (ro.recurringOrderState === 'Canceled' || ro.recurringOrderState === 'Expired') continue;
    try {
      await apiRoot.recurringOrders().withId({ ID: ro.id }).post({ body: { version: ro.version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'account-deleted' } }] } }).execute();
    } catch (error) {
      console.error(`[account] cancelling a subscription failed${statusOf(error) ? ` with status ${statusOf(error)}` : ''}`);
    }
  }
}
