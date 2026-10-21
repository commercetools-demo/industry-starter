// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Recurring orders for the local mock commercetools server (workstream N). A test double built from the DOCUMENTED behaviour
// (documentation page "Recurring Orders overview"), not from a live project: spike N-02 is still to be run live.
//
//  - Placing an order from a cart with recurring lines creates one recurring order and one recurring cart per distinct schedule
//    (documented "Create Order from Cart"); `originOrder` is set, state Active, nextOrderAt = start + one interval.
//  - setRecurringOrderState { type: paused | active | canceled }: paused clears nextOrderAt, active sets it again.
//  - setOrderSkipConfiguration { type: Counter, totalToSkip }: `skipped` starts at 0; nextOrderAt does NOT move (unverified live).
//  - setSchedule { recurrencePolicy }: only on an Active order with no pending skip (documented), else 400 InvalidOperation.
//  - Every update checks `version` (409 ConcurrentModification).
//
//   GET  /<project>/recurring-orders?where=customer(id=:customerId)&var.customerId=..., GET and POST /<project>/recurring-orders/<id>
//   GET  /<project>/orders?where=customerId=:customerId&var.customerId=...   (the orders the "hosted Checkout" placed)
//   GET  /__mock/recurring                      every recurring order
//   POST /__mock/recurring/seed { customerId, policyKey?, lastOrderAt? }   a recurring order without a checkout (for the account tab)
//   POST /__mock/recurring/process { id }      pretend the schedule ran: skipped += 1 when a skip is pending, lastOrderAt = now
// Nothing here is a real credential.

const RECURRING = new Map();
let seq = 0;

const uuid = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const addInterval = (iso, schedule) => {
  const d = new Date(iso);
  if (schedule.intervalUnit === 'Days') d.setUTCDate(d.getUTCDate() + schedule.value);
  else if (schedule.intervalUnit === 'Weeks') d.setUTCDate(d.getUTCDate() + 7 * schedule.value);
  else d.setUTCMonth(d.getUTCMonth() + schedule.value);
  return d.toISOString();
};

/** Recurring orders for a placed order, one per distinct schedule. Called by the order mock when it creates an order. */
export function createRecurringOrders(order, policies) {
  if (!order.customerId) return [];
  const groups = new Map();
  for (const line of order.lineItems) {
    const id = line.recurrenceInfo?.recurrencePolicy?.id;
    if (!id) continue;
    groups.set(id, [...(groups.get(id) ?? []), line]);
  }
  const out = [];
  for (const [policyId, lines] of groups) {
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) continue;
    seq += 1;
    const startsAt = new Date().toISOString();
    const total = lines.reduce((s, l) => s + l.totalPrice.centAmount, 0);
    const ro = {
      id: uuid(seq), version: 1, createdAt: startsAt, lastModifiedAt: startsAt, startsAt, nextOrderAt: addInterval(startsAt, policy.schedule),
      recurringOrderState: 'Active', schedule: policy.schedule, customer: { typeId: 'customer', id: order.customerId },
      cart: { typeId: 'cart', id: `rc-${seq}`, obj: { id: `rc-${seq}`, version: 1, cartOrigin: 'RecurringOrder', lineItems: lines, totalPrice: { type: 'centPrecision', currencyCode: lines[0].totalPrice.currencyCode, centAmount: total, fractionDigits: 2 } } },
      originOrder: { typeId: 'order', id: order.id, obj: order },
    };
    RECURRING.set(ro.id, ro);
    out.push(ro);
  }
  return out;
}

const invalid = (json, res, message) => json(res, 400, { statusCode: 400, message, errors: [{ code: 'InvalidOperation', message }] });

function apply(ro, action, policies) {
  const state = ro.recurringOrderState;
  const pending = ro.skipConfiguration ? Math.max(0, ro.skipConfiguration.totalToSkip - ro.skipConfiguration.skipped) : 0;
  if (action.action === 'setRecurringOrderState') {
    const type = action.recurringOrderState?.type;
    if (type === 'paused') {
      if (state !== 'Active') return 'only an active recurring order can be paused';
      ro.recurringOrderState = 'Paused';
      delete ro.nextOrderAt;
    } else if (type === 'active') {
      if (state === 'Canceled' || state === 'Expired') return 'a canceled recurring order cannot be activated';
      ro.recurringOrderState = 'Active';
      ro.nextOrderAt = addInterval(new Date().toISOString(), ro.schedule);
    } else if (type === 'canceled') {
      if (state === 'Canceled') return 'already canceled';
      ro.recurringOrderState = 'Canceled';
      delete ro.nextOrderAt;
    } else return 'unknown state';
    return null;
  }
  if (action.action === 'setOrderSkipConfiguration') {
    const draft = action.skipConfigurationInputDraft;
    if (draft?.type !== 'Counter' || !Number.isInteger(draft.totalToSkip) || draft.totalToSkip < 0) return 'bad skip configuration';
    ro.skipConfiguration = { type: 'Counter', totalToSkip: draft.totalToSkip, skipped: ro.skipConfiguration?.skipped ?? 0 };
    return null;
  }
  if (action.action === 'setSchedule') {
    if (state !== 'Active') return 'the recurring order must be active';
    if (pending > 0) return 'the recurring order has an active skip configuration';
    const policy = policies.find((p) => p.id === action.recurrencePolicy?.id);
    if (!policy) return 'unknown recurrence policy';
    ro.schedule = policy.schedule;
    ro.nextOrderAt = addInterval(new Date().toISOString(), policy.schedule);
    for (const l of ro.cart.obj.lineItems) l.recurrenceInfo = { ...l.recurrenceInfo, recurrencePolicy: { typeId: 'recurrence-policy', id: policy.id } };
    return null;
  }
  return 'unsupported action';
}

/** Returns false when the path is not ours. `deps`: { policies, json, readBody, project, placedOrders }. */
export async function recurringRoutes(req, res, url, path, deps) {
  const { policies, json, readBody, project } = deps;
  const base = `/${project}`;
  if (path === '/__mock/recurring' && req.method === 'GET') return json(res, 200, [...RECURRING.values()]);
  if (path === '/__mock/recurring/process' && req.method === 'POST') {
    const ro = RECURRING.get((await readBody(req)).id);
    if (!ro) return json(res, 404, { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound' }] });
    if (ro.skipConfiguration && ro.skipConfiguration.skipped < ro.skipConfiguration.totalToSkip) {
      ro.skipConfiguration.skipped += 1;
      ro.skipConfiguration.lastSkippedAt = new Date().toISOString();
    } else ro.lastOrderAt = new Date().toISOString();
    ro.nextOrderAt = addInterval(ro.nextOrderAt ?? new Date().toISOString(), ro.schedule);
    ro.version += 1;
    return json(res, 200, ro);
  }
  if (path === '/__mock/recurring/seed' && req.method === 'POST') {
    const b = await readBody(req);
    const policy = policies.find((p) => p.key === (b.policyKey ?? 'mcf-every-month')) ?? policies[0];
    const line = {
      id: `seed-line-${seq + 1}`, productId: 'seed-product', productSlug: { 'en-US': 'seed-pods' }, name: { 'en-US': 'Seeded Pods' }, quantity: 2,
      variant: { id: 1, sku: 'SEED-POD-50', attributes: [{ name: 'capsulesPerPack', value: 50 }], images: [] },
      price: { id: 'p', value: { type: 'centPrecision', currencyCode: 'USD', centAmount: 2205, fractionDigits: 2 } },
      totalPrice: { type: 'centPrecision', currencyCode: 'USD', centAmount: 4410, fractionDigits: 2 },
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: policy.id }, priceSelectionMode: 'Fixed' },
    };
    const [ro] = createRecurringOrders(
      { id: `seed-order-${seq + 1}`, orderNumber: `MC-SEED${seq + 1}`, customerId: b.customerId, lineItems: [line], createdAt: new Date().toISOString() },
      policies,
    );
    if (b.lastOrderAt) ro.lastOrderAt = b.lastOrderAt;
    return json(res, 201, ro);
  }
  if (path === `${base}/orders` && req.method === 'GET' && url.searchParams.get('var.customerId')) {
    const customerId = url.searchParams.get('var.customerId');
    const results = deps.placedOrders().filter((o) => o.customerId === customerId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const limit = Number(url.searchParams.get('limit') ?? 20);
    return json(res, 200, { limit, offset: 0, count: Math.min(results.length, limit), total: results.length, results: results.slice(0, limit) });
  }
  if (path === `${base}/recurring-orders` && req.method === 'GET') {
    const customerId = url.searchParams.get('var.customerId');
    const results = [...RECURRING.values()].filter((r) => r.customer.id === customerId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json(res, 200, { limit: 50, offset: 0, count: results.length, total: results.length, results });
  }
  const one = new RegExp(`^${base}/recurring-orders/([^/]+)$`).exec(path);
  if (one) {
    const ro = RECURRING.get(one[1]);
    if (!ro) return json(res, 404, { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound' }] });
    if (req.method === 'GET') return json(res, 200, ro);
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.version !== ro.version) return json(res, 409, { statusCode: 409, message: 'version', errors: [{ code: 'ConcurrentModification' }] });
      for (const action of body.actions ?? []) {
        const problem = apply(ro, action, policies);
        if (problem) return invalid(json, res, problem);
      }
      ro.version += 1;
      ro.lastModifiedAt = new Date().toISOString();
      return json(res, 200, ro);
    }
  }
  return false;
}
