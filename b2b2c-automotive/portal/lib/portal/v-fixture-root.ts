/* eslint-disable @typescript-eslint/no-explicit-any */
// An in-memory stand-in for the commercetools client of workstream V (customers, orders with returns, recurring orders, payments,
// reviews, custom objects, states). Used by V's unit tests (`createVFake`) and by the development fixture mode
// (`PORTAL_DEV_FIXTURES=on`, never in production, `getVFixture`). It implements exactly the calls the V services make and a tiny
// subset of the query predicate language; an unknown predicate throws, so a new query cannot silently match everything.
// No secrets, no personal data (synthetic `@example.com`).
import 'server-only';

type Obj = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const DAY = 86_400_000;

function httpError(statusCode: number, code: string, message = code): Error {
  return Object.assign(new Error(message), { statusCode, code: statusCode, body: { statusCode, message, errors: [{ code, message }] } });
}

const pick = (obj: Obj, path: string): unknown => path.split('.').reduce<any>((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);

/** One clause of a predicate (the forms V uses). */
function clause(obj: Obj, raw: string): boolean {
  const c = raw.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\w+) is not defined$/.exec(c))) return pick(obj, m[1]) === undefined;
  if ((m = /^(\w+) is not empty$/.exec(c))) {
    const v = pick(obj, m[1]);
    return Array.isArray(v) ? v.length > 0 : v !== undefined;
  }
  if ((m = /^(\w+)="([^"]*)"$/.exec(c))) return pick(obj, m[1]) === m[2];
  if ((m = /^store\(key="([^"]*)"\)$/.exec(c))) return obj.store?.key === m[1];
  if ((m = /^customer\(id="([^"]*)"\)$/.exec(c))) return obj.customer?.id === m[1];
  if ((m = /^custom\(fields\((\w+)="([^"]*)"\)\)$/.exec(c))) return obj.custom?.fields?.[m[1]] === m[2];
  if ((m = /^custom\(fields\((\w+) is not defined\)\)$/.exec(c))) return obj.custom?.fields?.[m[1]] === undefined;
  if ((m = /^value\((\w+)="([^"]*)"\)$/.exec(c))) return obj.value?.[m[1]] === m[2];
  if ((m = /^container="([^"]*)"$/.exec(c))) return obj.container === m[1];
  throw httpError(400, 'InvalidInput', `fixture does not understand the predicate "${c}"`);
}

function matches(obj: Obj, where: unknown): boolean {
  const list = (Array.isArray(where) ? where : where === undefined ? [] : [where]) as string[];
  return list.every((w) => w.split(/ and /).every((part) => clause(obj, part)));
}

function sortBy(all: Obj[], sort: unknown): Obj[] {
  const spec = (Array.isArray(sort) ? sort[0] : sort) as string | undefined;
  if (!spec) return all;
  const [field, dir] = spec.split(' ');
  const sign = dir === 'desc' ? -1 : 1;
  return [...all].sort((a, b) => {
    const x = pick(a, field) as any;
    const y = pick(b, field) as any;
    if (x === y) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return x < y ? -sign : sign;
  });
}

export interface VFake {
  root: unknown;
  db: { customers: Obj[]; orders: Obj[]; recurring: Obj[]; reviews: Obj[]; payments: Obj[]; products: Obj[]; objects: Map<string, Obj>; states: Obj[] };
  calls: { op: string; args?: unknown }[];
  /** Fixture mode only: adds a Refund transaction as Checkout would (Pending first, Success on the second read). */
  refundPayment: (paymentId: string, amount: { centAmount: number; currencyCode: string }) => { outcome: 'received' };
  now: () => Date;
}

let seq = 0;
const nextId = (p: string) => `${p}-v${(seq += 1)}`;

export function createVFake(options: { now?: () => Date; demo?: boolean; autoConfirmRefunds?: boolean } = {}): VFake {
  const now = options.now ?? (() => new Date());
  const db: VFake['db'] = { customers: [], orders: [], recurring: [], reviews: [], payments: [], products: [], objects: new Map(), states: [] };
  const calls: VFake['calls'] = [];
  const request = <T>(op: string, run: () => T, args?: unknown) => ({
    execute: async () => {
      calls.push({ op, args: args === undefined ? undefined : clone(args) });
      return { body: clone(run()), statusCode: 200 };
    },
  });
  const page = (all: Obj[], a: any) => {
    const filtered = sortBy(all.filter((o) => matches(o, a?.queryArgs?.where)), a?.queryArgs?.sort);
    const offset = Number(a?.queryArgs?.offset ?? 0);
    const limit = Number(a?.queryArgs?.limit ?? 20);
    return { results: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit, count: Math.min(limit, Math.max(0, filtered.length - offset)) };
  };
  const one = (all: Obj[], test: (o: Obj) => boolean): Obj => {
    const found = all.find(test);
    if (!found) throw httpError(404, 'ResourceNotFound');
    return found;
  };

  // ---- orders ----
  const applyOrderActions = (order: Obj, actions: Obj[]) => {
    const item = (id: string) => {
      for (const info of order.returnInfo ?? []) for (const it of info.items) if (it.id === id) return it;
      throw httpError(400, 'InvalidOperation', `unknown return item ${id}`);
    };
    for (const a of actions) {
      switch (a.action) {
        case 'addReturnInfo': {
          const items = (a.items as Obj[]).map((i) => ({
            id: nextId('ri'),
            type: 'LineItemReturnItem',
            quantity: i.quantity,
            lineItemId: i.lineItemId,
            comment: i.comment,
            shipmentState: i.shipmentState,
            paymentState: 'Initial',
            createdAt: now().toISOString(),
            lastModifiedAt: now().toISOString(),
            ...(i.custom ? { custom: { type: { typeId: 'type', id: `type-${i.custom.type.key}` }, fields: { ...i.custom.fields } } } : {}),
          }));
          order.returnInfo = [...(order.returnInfo ?? []), { returnTrackingId: a.returnTrackingId, returnDate: a.returnDate, items }];
          break;
        }
        case 'setReturnShipmentState':
          item(a.returnItemId).shipmentState = a.shipmentState;
          break;
        case 'setReturnPaymentState':
          item(a.returnItemId).paymentState = a.paymentState;
          break;
        case 'setReturnItemCustomField': {
          const it = item(a.returnItemId);
          it.custom ??= { type: { typeId: 'type', id: 'type-malva-return-item' }, fields: {} };
          if (a.value === undefined) delete it.custom.fields[a.name];
          else it.custom.fields[a.name] = a.value;
          break;
        }
        case 'setCustomType':
          order.custom = { type: { typeId: 'type', id: `type-${a.type.key}` }, fields: { ...(a.fields ?? {}) } };
          break;
        case 'setCustomField':
          if (!order.custom) throw httpError(400, 'InvalidOperation', 'order has no custom type');
          order.custom.fields[a.name] = a.value;
          break;
        default:
          throw httpError(400, 'InvalidOperation', `unsupported order action ${a.action}`);
      }
    }
    order.version += 1;
    order.lastModifiedAt = now().toISOString();
  };
  const orderApi = (store: string, find: () => Obj) => ({
    get: () => request('order.get', () => find()),
    post: ({ body }: { body: Obj }) =>
      request(
        'order.update',
        () => {
          const order = find();
          if (order.store?.key !== store) throw httpError(404, 'ResourceNotFound');
          if (body.version !== order.version) throw httpError(409, 'ConcurrentModification');
          applyOrderActions(order, body.actions);
          return order;
        },
        body,
      ),
  });
  const inStore = ({ storeKey }: { storeKey: string }) => {
    const orders = () => db.orders.filter((o) => o.store?.key === storeKey);
    return {
      customers: () => ({
        get: (a: any) => request('customer.list', () => page(db.customers.filter((c) => c.stores?.some((s: Obj) => s.key === storeKey)), a), a),
        withId: ({ ID }: { ID: string }) => ({
          get: () => request('customer.get', () => one(db.customers, (c) => c.id === ID && c.stores?.some((s: Obj) => s.key === storeKey)), { ID }),
        }),
      }),
      orders: () => ({
        get: (a: any) => request('order.list', () => page(orders(), a), a),
        withId: ({ ID }: { ID: string }) => orderApi(storeKey, () => one(orders(), (o) => o.id === ID)),
        withOrderNumber: ({ orderNumber }: { orderNumber: string }) => orderApi(storeKey, () => one(orders(), (o) => o.orderNumber === orderNumber)),
      }),
    };
  };

  // ---- recurring orders ----
  const recurringApi = (find: () => Obj) => ({
    get: () => request('recurringOrder.get', () => find()),
    post: ({ body }: { body: Obj }) =>
      request(
        'recurringOrder.update',
        () => {
          const r = find();
          if (body.version !== r.version) throw httpError(409, 'ConcurrentModification');
          for (const a of body.actions as Obj[]) {
            if (a.action === 'setRecurringOrderState') {
              const type = a.recurringOrderState?.type as string;
              r.recurringOrderState = type === 'paused' ? 'Paused' : type === 'active' ? 'Active' : type === 'canceled' ? 'Canceled' : 'Expired';
              if (r.recurringOrderState !== 'Active') delete r.nextOrderAt;
              else r.nextOrderAt ??= new Date(now().getTime() + 30 * DAY).toISOString();
            } else if (a.action === 'setOrderSkipConfiguration') {
              const draft = a.skipConfigurationInputDraft as Obj;
              r.skipConfiguration = { type: 'Counter', totalToSkip: draft.totalToSkip, skipped: 0 };
            } else throw httpError(400, 'InvalidOperation', `unsupported recurring order action ${a.action}`);
          }
          r.version += 1;
          return r;
        },
        body,
      ),
  });

  // ---- reviews ----
  const reviewApi = (find: () => Obj) => ({
    get: () => request('review.get', () => find()),
    post: ({ body }: { body: Obj }) =>
      request(
        'review.update',
        () => {
          const r = find();
          if (body.version !== r.version) throw httpError(409, 'ConcurrentModification');
          for (const a of body.actions as Obj[]) {
            if (a.action === 'setCustomField') {
              r.custom ??= { type: { typeId: 'type', id: 'type-malva-review' }, fields: {} };
              r.custom.fields[a.name] = a.value;
            } else if (a.action === 'transitionState') {
              const state = db.states.find((s) => s.key === a.state.key || s.id === a.state.id);
              if (!state) throw httpError(400, 'InvalidOperation', 'unknown state');
              r.state = { typeId: 'state', id: state.id, obj: { key: state.key, id: state.id } };
            } else throw httpError(400, 'InvalidOperation', `unsupported review action ${a.action}`);
          }
          r.version += 1;
          return r;
        },
        body,
      ),
  });

  // ---- custom objects ----
  const objectKey = (container: string, key: string) => `${container}/${key}`;
  const customObjects = () => ({
    post: ({ body }: { body: Obj }) =>
      request(
        'object.write',
        () => {
          const k = objectKey(body.container, body.key);
          const current = db.objects.get(k);
          if (body.version === 0 && current) throw httpError(409, 'ConcurrentModification');
          if (body.version !== undefined && body.version !== 0 && (!current || current.version !== body.version)) throw httpError(409, 'ConcurrentModification');
          const next = { id: current?.id ?? nextId('obj'), container: body.container, key: body.key, version: (current?.version ?? 0) + 1, value: clone(body.value) };
          db.objects.set(k, next);
          return next;
        },
        body,
      ),
    withContainerAndKey: ({ container, key }: { container: string; key: string }) => ({
      get: () => request('object.get', () => {
        const found = db.objects.get(objectKey(container, key));
        if (!found) throw httpError(404, 'ResourceNotFound');
        return found;
      }),
    }),
    withContainer: ({ container }: { container: string }) => ({
      get: (a: any) => request('object.list', () => page([...db.objects.values()].filter((o) => o.container === container), a), a),
    }),
  });

  // ---- payments (Checkout adds Refund transactions; the portal never writes them) ----
  const payments = () => ({
    withId: ({ ID }: { ID: string }) => ({
      get: () =>
        request('payment.get', () => {
          const p = one(db.payments, (x) => x.id === ID);
          // Fixture mode only: a Pending refund is confirmed by the "connector" on the read after the one that showed it.
          if (options.autoConfirmRefunds) for (const t of p.transactions) if (t.type === 'Refund' && t.state === 'Pending') {
            if (t.polled) t.state = 'Success';
            else t.polled = true;
          }
          return p;
        }),
    }),
  });

  const root = {
    inStoreKeyWithStoreKeyValue: inStore,
    recurringOrders: () => ({
      get: (a: any) => request('recurringOrder.list', () => page(db.recurring, a), a),
      withId: ({ ID }: { ID: string }) => recurringApi(() => one(db.recurring, (r) => r.id === ID)),
    }),
    reviews: () => ({
      get: (a: any) => request('review.list', () => page(db.reviews, a), a),
      withId: ({ ID }: { ID: string }) => reviewApi(() => one(db.reviews, (r) => r.id === ID)),
    }),
    states: () => ({
      withKey: ({ key }: { key: string }) => ({ get: () => request('state.get', () => one(db.states, (s) => s.key === key)) }),
    }),
    payments,
    customObjects,
  };

  db.states.push(
    { id: 'state-review-published', key: 'review-published', type: 'ReviewState' },
    { id: 'state-review-hidden', key: 'review-hidden', type: 'ReviewState' },
  );

  const fake: VFake = {
    root,
    db,
    calls,
    now,
    refundPayment(paymentId, amount) {
      const p = one(db.payments, (x) => x.id === paymentId);
      p.transactions.push({ id: nextId('tx'), type: 'Refund', state: 'Pending', amount: { ...amount }, timestamp: now().toISOString() });
      return { outcome: 'received' };
    },
  };
  if (options.demo) seedDemo(fake);
  return fake;
}

const NAME = (de: string, en: string) => ({ 'de-DE': de, 'en-US': en });

/** Demo data of the development mode: shoppers, guest checkouts, orders (one undelivered, one past the window), returns, subscriptions, reviews. */
function seedDemo(fake: VFake): void {
  const { db } = fake;
  const t = fake.now().getTime();
  const iso = (daysAgo: number) => new Date(t - daysAgo * DAY).toISOString();
  const inDays = (days: number) => new Date(t + days * DAY).toISOString();
  const stores = ['fx-store-online', 'fx-store-direct', 'fx-store-south'];
  const catalog = [
    { productId: 'prod-pads', sku: 'FX-BRAKE-001', name: NAME('Bremsbelag-Satz vorn', 'Front brake pad set'), cents: 5900 },
    { productId: 'prod-disc', sku: 'FX-BRAKE-002', name: NAME('Bremsscheibe vorn', 'Front brake disc'), cents: 8900 },
    { productId: 'prod-oil', sku: 'FX-OIL-001', name: NAME('Motoröl 5W-30, 5 l', 'Engine oil 5W-30, 5 l'), cents: 4500 },
  ];
  for (const p of catalog) db.products.push({ id: p.productId, name: p.name });
  const line = (n: number, p: (typeof catalog)[number], quantity: number, fit?: string) => ({
    id: `li-${n}`,
    productId: p.productId,
    name: p.name,
    quantity,
    variant: { sku: p.sku },
    price: { value: { centAmount: p.cents, currencyCode: 'EUR' } },
    totalPrice: { centAmount: p.cents * quantity, currencyCode: 'EUR', fractionDigits: 2 },
    taxedPrice: { totalNet: { centAmount: Math.round((p.cents * quantity) / 1.19), currencyCode: 'EUR' }, totalGross: { centAmount: p.cents * quantity, currencyCode: 'EUR' } },
    ...(fit ? { custom: { type: { typeId: 'type', id: 'type-malva-line' }, fields: { vehicle: JSON.stringify({ make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' }), fit } } } : {}),
  });
  let orderSeq = 100;
  const makeOrder = (store: string, customerId: string | undefined, email: string, daysAgo: number, lines: ReturnType<typeof line>[], deliveredDaysAgo: number | null, paid = true) => {
    orderSeq += 1;
    const total = lines.reduce((s, l) => s + l.totalPrice.centAmount, 0);
    const order: Obj = {
      id: `fx-order-${orderSeq}`,
      version: 1,
      orderNumber: `MLV-${orderSeq}`,
      ...(customerId ? { customerId } : {}),
      customerEmail: email,
      createdAt: iso(daysAgo),
      lastModifiedAt: iso(daysAgo),
      store: { typeId: 'store', key: store },
      orderState: 'Open',
      shipmentState: deliveredDaysAgo === null ? 'Pending' : 'Shipped',
      lineItems: lines,
      totalPrice: { centAmount: total, currencyCode: 'EUR', fractionDigits: 2 },
      ...(customerId ? {} : { shippingAddress: { firstName: 'Gast', lastName: 'Besteller' } }),
      ...(deliveredDaysAgo === null ? {} : { custom: { type: { typeId: 'type', id: 'type-malva-checkout' }, fields: { deliveredAt: iso(deliveredDaysAgo) } } }),
    };
    if (paid) {
      const payment = { id: `fx-pay-${orderSeq}`, version: 1, transactions: [{ id: `fx-tx-${orderSeq}`, type: 'Charge', state: 'Success', amount: { centAmount: total, currencyCode: 'EUR' }, timestamp: iso(daysAgo) }] };
      db.payments.push(payment);
      order.paymentInfo = { payments: [{ typeId: 'payment', id: payment.id }] };
    }
    db.orders.push(order);
    return order;
  };
  const addReturn = (order: Obj, number: string, lineIndex: number, quantity: number, status: string, reason: string, extra: Obj = {}) => {
    const shipmentState = status === 'requested' || status === 'in-transit' ? 'Advised' : status === 'rejected' ? 'Unusable' : 'Returned';
    order.returnInfo = [
      ...(order.returnInfo ?? []),
      {
        returnTrackingId: `RT-${number}`,
        returnDate: iso(2),
        items: [{ id: `ri-${number}`, type: 'LineItemReturnItem', quantity, lineItemId: order.lineItems[lineIndex].id, shipmentState, paymentState: status === 'refunded' ? 'Refunded' : 'Initial', createdAt: iso(2), lastModifiedAt: iso(1), custom: { type: { typeId: 'type', id: 'type-malva-return-item' }, fields: { returnNumber: number, status, reason, ...extra } } }],
      },
    ];
  };
  const shoppers = [
    { n: 1, first: 'Anna', last: 'Muster', consent: true },
    { n: 2, first: 'Ben', last: 'Beispiel', consent: false },
    { n: 3, first: 'Cem', last: 'Probe', consent: null },
  ];
  for (const store of stores) {
    for (const s of shoppers) {
      if (store === 'fx-store-south' && s.n > 1) continue;
      const id = `fx-shopper-${store.replace('fx-store-', '')}-${s.n}`;
      db.customers.push({
        id,
        version: 1,
        email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}.${store.replace('fx-store-', '')}@example.com`,
        firstName: s.first,
        lastName: s.last,
        createdAt: iso(200 - s.n * 20),
        stores: [{ typeId: 'store', key: store }],
        custom: { type: { typeId: 'type', id: 'type-malva-customer' }, fields: { mobile: '+49 151 0000000', garage: JSON.stringify({ vehicles: [{ id: 'volkswagen-golf-2016-2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' }], activeId: 'volkswagen-golf-2016-2-0-tdi' }), ...(s.consent === null ? {} : { marketingConsent: s.consent, marketingConsentAt: iso(90) }) } },
      });
    }
  }
  for (const store of stores) {
    const short = store.replace('fx-store-', '');
    const c = (n: number) => `fx-shopper-${short}-${n}`;
    const email = (n: number) => `${shoppers[n - 1].first.toLowerCase()}.${shoppers[n - 1].last.toLowerCase()}.${short}@example.com`;
    const o1 = makeOrder(store, c(1), email(1), 12, [line(1, catalog[0], 1, 'not-fit'), line(2, catalog[1], 2, 'fits')], 10);
    addReturn(o1, `RET-${o1.orderNumber}-1`, 0, 1, 'requested', 'wrong-fit');
    makeOrder(store, c(1), email(1), 60, [line(3, catalog[2], 1)], 45);
    if (store === 'fx-store-south') continue;
    const o3 = makeOrder(store, c(2), email(2), 8, [line(4, catalog[0], 2), line(5, catalog[2], 1)], 5);
    addReturn(o3, `RET-${o3.orderNumber}-1`, 0, 1, 'inspected', 'defective', { refundCents: 5900, refundRequestedAt: iso(1) });
    const pay = db.payments.find((p) => p.id === o3.paymentInfo.payments[0].id) as Obj;
    pay.transactions.push({ id: `fx-refund-${o3.orderNumber}`, type: 'Refund', state: 'Failure', amount: { centAmount: 5900, currencyCode: 'EUR' }, timestamp: iso(0.5) });
    const o4 = makeOrder(store, c(2), email(2), 30, [line(6, catalog[1], 1)], 25);
    addReturn(o4, `RET-${o4.orderNumber}-1`, 0, 1, 'received', 'no-longer-needed');
    makeOrder(store, c(3), email(3), 2, [line(7, catalog[2], 1)], null);
    makeOrder(store, undefined, 'guest@example.com', 15, [line(8, catalog[0], 1)], 12);
    makeOrder(store, undefined, 'guest@example.com', 40, [line(9, catalog[2], 2)], 36);
    makeOrder(store, undefined, 'other.guest@example.com', 20, [line(10, catalog[1], 1)], null);
  }
  const rec = (store: string, n: number, state: string, schedule: Obj, nextInDays: number | null, product: (typeof catalog)[number], qty: number, shopper: number) => {
    const cust = db.customers.find((x) => x.id === `fx-shopper-${store.replace('fx-store-', '')}-${shopper}`) as Obj;
    db.recurring.push({
      id: `fx-rec-${store}-${n}`,
      version: 1,
      key: `fx-rec-${store}-${n}`,
      createdAt: iso(100),
      store: { typeId: 'store', key: store },
      recurringOrderState: state,
      schedule,
      ...(nextInDays === null ? {} : { nextOrderAt: inDays(nextInDays) }),
      skipConfiguration: { type: 'Counter', totalToSkip: 0, skipped: 0 },
      customer: { typeId: 'customer', id: cust.id, obj: { firstName: cust.firstName, lastName: cust.lastName, email: cust.email } },
      cart: { typeId: 'cart', id: `fx-cart-${store}-${n}`, obj: { id: `fx-cart-${store}-${n}`, totalPrice: { centAmount: product.cents * qty, currencyCode: 'EUR' }, lineItems: [{ quantity: qty, name: product.name }] } },
    });
  };
  for (const store of ['fx-store-online', 'fx-store-direct']) {
    rec(store, 1, 'Active', { type: 'standard', value: 1, intervalUnit: 'Months' }, 3, catalog[2], 1, 1);
    rec(store, 2, 'Active', { type: 'standard', value: 3, intervalUnit: 'Months' }, 20, catalog[0], 2, 2);
    rec(store, 3, 'Paused', { type: 'standard', value: 2, intervalUnit: 'Weeks' }, null, catalog[2], 1, 3);
    rec(store, 4, 'Canceled', { type: 'dayOfMonth', day: 15 }, null, catalog[1], 1, 2);
  }
  rec('fx-store-south', 1, 'Active', { type: 'standard', value: 1, intervalUnit: 'Months' }, 5, catalog[2], 1, 1);

  const review = (n: number, store: string, productId: string, rating: number, title: string, state: 'review-published' | 'review-hidden', reply?: string, daysAgo = n) => {
    const st = db.states.find((s) => s.key === state) as Obj;
    db.reviews.push({
      id: `fx-review-${n}`,
      version: 1,
      createdAt: iso(daysAgo),
      authorName: shoppers[(n % 3)].first + ' ' + shoppers[n % 3].last[0] + '.',
      title,
      text: `${title}, synthetic review text.`,
      rating,
      target: { typeId: 'product', id: productId, obj: { masterData: { current: { name: (db.products.find((p) => p.id === productId) as Obj).name } } } },
      state: { typeId: 'state', id: st.id, obj: { key: st.key, id: st.id } },
      custom: { type: { typeId: 'type', id: 'type-malva-review' }, fields: { storeKey: store, ...(reply ? { replyText: reply, replyAt: iso(daysAgo - 1), replyBy: 'Store team' } : {}) } },
    });
  };
  review(1, 'fx-store-online', 'prod-pads', 5, 'Sehr gut', 'review-published', 'Danke für die Bewertung!', 20);
  review(2, 'fx-store-online', 'prod-disc', 2, 'Quietscht', 'review-published', undefined, 5);
  review(3, 'fx-store-online', 'prod-oil', 4, 'Gut', 'review-published', undefined, 3);
  review(4, 'fx-store-online', 'prod-oil', 1, 'Spam', 'review-hidden', undefined, 2);
  review(5, 'fx-store-direct', 'prod-oil', 3, 'Okay', 'review-published', undefined, 1);
  review(6, 'fx-store-south', 'prod-pads', 5, 'Top', 'review-published', undefined, 1);
}

// Kept on `globalThis`: the dev server bundles each route separately, and a module level variable would give every route its own copy.
const holder = globalThis as unknown as { __malvaVFixture?: VFake };
/** The singleton of the development fixture mode, with demo data. */
export function getVFixture(): VFake {
  holder.__malvaVFixture ??= createVFake({ demo: true, autoConfirmRefunds: true });
  return holder.__malvaVFixture;
}

export const vFixtureRoot = new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (getVFixture().root as Record<string | symbol, unknown>)[prop],
});
