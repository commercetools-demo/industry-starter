// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Account area for the local mock commercetools server (workstream L). A test double, not a spec: it serves the four seeded
// order states, orders for three demo customers (a collect order in each state ordered, preparing, ready-for-collection and
// collected; delivery orders shipped in two parcels and delivered; one mixed order; a Canadian customer; a customer whose order
// is "someone else's"), customer updates (names, addresses with defaults, password, delete), shopping lists, stored payment
// methods (with a token the storefront must never show) and a hook to move an order along.
//
//   POST /__mock/order { orderNumber, state?: 'ordered'|'preparing'|'ready-for-collection'|'collected', shipmentState?: string,
//                        deliver?: { items: [{ id, quantity }], trackingId?: string }, returnState?: { shipmentState?, paymentState? } }
//   GET  /__mock/account   every order, list and method the mock holds (to read results back)
// Customers: cust-1 Maya (US), cust-2 Liam (US, owns MCF-3001), cust-3 Priya (Canada).
import { DOC_BY_ID, DOCS } from './mock-catalog.mjs';

const DAY = 86400000;

export function createAccountMock({ PROJECT, CUSTOMERS, STORES, demoLine, baseCart, reprice, centMoney, readBody, json }) {
  const notFound = (res) => json(res, 404, { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound' }] });
  const conflict = (res) => json(res, 409, { statusCode: 409, message: 'Object has a different version', errors: [{ code: 'ConcurrentModification' }] });
  const bad = (res, code, message = 'bad') => json(res, 400, { statusCode: 400, message, errors: [{ code, message }] });
  const list = (results, total = results.length, offset = 0, limit = 20) => ({ limit, offset, count: results.length, total, results });
  const customerById = (id) => [...CUSTOMERS.values()].find((e) => e.customer.id === id);
  const now = () => new Date().toISOString();
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

  // ---------------------------------------------------------------- states
  const STATE_KEYS = ['ordered', 'preparing', 'ready-for-collection', 'collected'];
  const STATES = STATE_KEYS.map((k) => ({ id: `st-${k}`, version: 1, key: `mcf-order-${k}`, type: 'OrderState', initial: k === 'ordered' }));
  const stateRef = (k) => ({ typeId: 'state', id: `st-${k}`, obj: STATES.find((s) => s.id === `st-${k}`) });

  // ---------------------------------------------------------------- addresses of the demo customers
  let addrSeq = 0;
  const addAddr = (cust, label, street, city, state, zip, country, phone) => {
    addrSeq += 1;
    const a = {
      id: `addr-${addrSeq}`, key: `k-${addrSeq}`, country, firstName: cust.firstName, lastName: cust.lastName, streetName: street, city, postalCode: zip,
      ...(state ? { state } : {}), ...(label ? { additionalAddressInfo: label } : {}), ...(phone ? { phone } : {}),
    };
    cust.addresses.push(a);
    cust.shippingAddressIds = [...(cust.shippingAddressIds ?? []), a.id];
    cust.billingAddressIds = [...(cust.billingAddressIds ?? []), a.id];
    return a;
  };
  const maya = customerById('cust-1')?.customer;
  const priya = customerById('cust-3')?.customer;
  if (maya && maya.addresses.length === 0) {
    const home = addAddr(maya, 'Home', '100 Example Street', 'New York', 'NY', '10012', 'US', '+1 212 555 0100');
    addAddr(maya, 'Work', '250 Sample Avenue', 'New York', 'NY', '10001', 'US', '');
    maya.defaultShippingAddressId = home.id;
    maya.defaultBillingAddressId = home.id;
  }
  if (priya && priya.addresses.length === 0) {
    const a = addAddr(priya, 'Home', '88 Example Street', 'Toronto', 'ON', 'M5V 2T6', 'CA', '+1 416 555 0188');
    priya.defaultShippingAddressId = a.id;
    priya.defaultBillingAddressId = a.id;
  }

  // ---------------------------------------------------------------- orders
  const ORDERS = new Map();
  let orderSeq = 0;
  const lineOf = (cart, sku, qty, fulfilment, storeIndex) => {
    const l = demoLine(cart, sku, qty, `ol-${++orderSeq}`);
    l.custom = { type: { typeId: 'type', id: 'mcf-line-fulfilment' }, fields: { fulfilment } };
    if (fulfilment === 'collect') l.supplyChannel = { typeId: 'channel', id: STORES[storeIndex].id, obj: STORES[storeIndex] };
    return l;
  };
  function makeOrder({ number, customerId, country = 'US', currency = 'USD', lines, state, shipmentState, ageDays = 3, modifiedDaysAgo, deliveries = () => [], shipping = 695 }) {
    const cart = baseCart(`oc-${number}`, { customerId }, { country, totalPrice: centMoney(currency, 0) });
    for (const [sku, qty, fulfilment, storeIndex] of lines) cart.lineItems.push(lineOf(cart, sku, qty, fulfilment, storeIndex));
    reprice(cart);
    const hasShip = lines.some((l) => l[2] !== 'collect');
    const net = cart.lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0);
    const ship = hasShip ? shipping : 0;
    const tax = Math.round((net + ship) * (country === 'CA' ? 0.05 : 0.08));
    const order = {
      id: `order-${number}`, version: 1, orderNumber: number, customerId, createdAt: ago(ageDays), lastModifiedAt: ago(modifiedDaysAgo ?? ageDays - 1),
      orderState: 'Open', shipmentState, paymentState: 'Paid', shippingMode: 'Single', country,
      lineItems: cart.lineItems, customLineItems: [],
      totalPrice: centMoney(currency, net + ship),
      taxedPrice: { totalNet: centMoney(currency, net + ship), totalGross: centMoney(currency, net + ship + tax), totalTax: centMoney(currency, tax), taxPortions: [] },
      ...(state ? { state: stateRef(state) } : {}),
      ...(hasShip
        ? {
            shippingAddress: { country, firstName: 'Demo', lastName: 'Shopper', streetName: '100 Example Street', city: country === 'CA' ? 'Toronto' : 'New York', state: country === 'CA' ? 'ON' : 'NY', postalCode: country === 'CA' ? 'M5V 2T6' : '10012' },
            shippingInfo: { shippingMethodName: 'Standard', price: centMoney(currency, ship), deliveries: deliveries(cart.lineItems) },
          }
        : {}),
    };
    ORDERS.set(order.id, order);
    return order;
  }
  const delivery = (id, items, trackingId, carrier = 'UPS') => ({
    id, createdAt: ago(2), items, parcels: [{ id: `p-${id}`, createdAt: ago(2), ...(trackingId ? { trackingData: { trackingId, carrier } } : {}) }],
  });
  const E10 = 'MCF-POD-EMBER-10';
  const C10 = 'MCF-POD-CASA-10';
  const E50 = 'MCF-POD-EMBER-50';
  // Maya, US. Collect orders in each state, newest first by age.
  makeOrder({ number: 'MCF-1001', customerId: 'cust-1', lines: [[E10, 2, 'collect', 0]], state: 'ordered', ageDays: 1 });
  makeOrder({ number: 'MCF-1002', customerId: 'cust-1', lines: [[C10, 1, 'collect', 1]], state: 'preparing', ageDays: 2 });
  makeOrder({ number: 'MCF-1003', customerId: 'cust-1', lines: [[E10, 1, 'collect', 0], [C10, 2, 'collect', 0]], state: 'ready-for-collection', ageDays: 3 });
  makeOrder({ number: 'MCF-1004', customerId: 'cust-1', lines: [[E50, 1, 'collect', 2]], state: 'collected', ageDays: 6, modifiedDaysAgo: 4 });
  // Delivery orders: shipped in two parcels (partial shipment shown), delivered, delivered long ago (return window closed).
  makeOrder({
    number: 'MCF-1005', customerId: 'cust-1', lines: [[E10, 4, 'delivery'], [C10, 1, 'delivery']], shipmentState: 'Shipped', ageDays: 5,
    deliveries: (l) => [delivery('d1', [{ id: l[0].id, quantity: 2 }], '1Z999AA10123456784'), delivery('d2', [{ id: l[0].id, quantity: 2 }, { id: l[1].id, quantity: 1 }], '')],
  });
  makeOrder({ number: 'MCF-1006', customerId: 'cust-1', lines: [[E10, 2, 'delivery'], [E50, 1, 'delivery']], shipmentState: 'Delivered', ageDays: 9, modifiedDaysAgo: 5, deliveries: () => [delivery('d1', [], '1Z999AA10123456790')] });
  makeOrder({ number: 'MCF-1007', customerId: 'cust-1', lines: [[C10, 3, 'delivery']], shipmentState: 'Delivered', ageDays: 80, modifiedDaysAgo: 75 });
  makeOrder({
    number: 'MCF-1008', customerId: 'cust-1', lines: [[E10, 1, 'collect', 0], [C10, 1, 'delivery']], state: 'ready-for-collection', shipmentState: 'Shipped', ageDays: 4,
    deliveries: (l) => [delivery('d1', [{ id: l[1].id, quantity: 1 }], '9400111899223197428490', 'USPS')],
  });
  for (let n = 9; n <= 15; n += 1) {
    makeOrder({ number: `MCF-10${String(n).padStart(2, '0')}`, customerId: 'cust-1', lines: [[E10, 1, 'delivery']], shipmentState: 'Delivered', ageDays: 90 + n, modifiedDaysAgo: 85 + n });
  }
  // Priya, Canada: delivery only, CAD.
  makeOrder({ number: 'MCF-2001', customerId: 'cust-3', country: 'CA', currency: 'CAD', lines: [[E10, 2, 'delivery']], shipmentState: 'Shipped', ageDays: 2, shipping: 895, deliveries: (l) => [delivery('d1', [{ id: l[0].id, quantity: 2 }], 'CP123456789CA', 'Canada Post')] });
  makeOrder({ number: 'MCF-2002', customerId: 'cust-3', country: 'CA', currency: 'CAD', lines: [[C10, 1, 'delivery']], shipmentState: 'Delivered', ageDays: 8, modifiedDaysAgo: 3, shipping: 895 });
  // Liam: the order that is "someone else's" for Maya.
  makeOrder({ number: 'MCF-3001', customerId: 'cust-2', lines: [[E10, 1, 'delivery']], shipmentState: 'Delivered', ageDays: 4, modifiedDaysAgo: 2 });

  const orderBy = (n) => [...ORDERS.values()].find((o) => o.orderNumber === n);

  function filterOrders(url) {
    const v = (name) => url.searchParams.get(`var.${name}`);
    const where = url.searchParams.get('where') ?? '';
    let all = [...ORDERS.values()].filter((o) => o.customerId === v('id'));
    if (where.includes('state(id=:ready)')) all = all.filter((o) => o.state?.id === v('ready'));
    if (where.includes('(state(id=:done) or shipmentState="Delivered")')) all = all.filter((o) => o.state?.id === v('done') || o.shipmentState === 'Delivered');
    if (where.includes('not(state(id=:done))')) all = all.filter((o) => o.state?.id !== v('done'));
    if (where.includes('not(shipmentState="Delivered")')) all = all.filter((o) => o.shipmentState !== 'Delivered');
    if (where.includes('orderState!="Cancelled"')) all = all.filter((o) => o.orderState !== 'Cancelled');
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    return list(all.slice(offset, offset + limit), all.length, offset, limit);
  }

  function updateOrder(order, body) {
    if (body.version !== order.version) return false;
    for (const a of body.actions ?? []) {
      if (a.action === 'addReturnInfo') {
        order.returnInfo = [
          ...(order.returnInfo ?? []),
          {
            returnDate: a.returnDate, ...(a.returnTrackingId ? { returnTrackingId: a.returnTrackingId } : {}),
            items: a.items.map((i, n) => ({
              id: `ri-${order.id}-${(order.returnInfo ?? []).length + 1}-${n + 1}`, type: 'LineItemReturnItem', lineItemId: i.lineItemId, quantity: i.quantity,
              ...(i.comment ? { comment: i.comment } : {}), shipmentState: i.shipmentState ?? 'Advised', paymentState: 'Initial', createdAt: now(), lastModifiedAt: now(),
            })),
          },
        ];
      }
    }
    order.version += 1;
    order.lastModifiedAt = now();
    return true;
  }

  // ---------------------------------------------------------------- shopping lists
  const LISTS = new Map();
  let listSeq = 0;
  let lineSeq = 0;
  const lineItemOf = (productId, variantId) => {
    const doc = DOC_BY_ID.get(productId);
    if (!doc) return null;
    const variant = doc.variants.find((v) => v.id === variantId) ?? doc.variants[0];
    const vid = variant.id ?? 1;
    return {
      id: `sli-${++lineSeq}`, productId, variantId: vid, quantity: 1, addedAt: now(), name: doc.name, published: true,
      variant: { id: vid, sku: variant.sku },
    };
  };
  const saveDemoList = (customerId, productIds) => {
    listSeq += 1;
    const l = { id: `sl-${listSeq}`, version: 1, key: `mcf-saved-${customerId}`, customer: { typeId: 'customer', id: customerId }, name: { 'en-US': 'Saved items' }, lineItems: [], textLineItems: [] };
    productIds.forEach((p) => l.lineItems.push(lineItemOf(p, undefined)));
    LISTS.set(l.id, l);
    return l;
  };
  saveDemoList('cust-1', [DOCS[0].id, DOCS[2].id, DOCS[5].id]);

  // ---------------------------------------------------------------- stored payment methods
  const METHODS = new Map();
  const addMethod = (customerId, name, isDefault) => {
    const m = {
      id: `pm-${METHODS.size + 1}`, version: 1, customer: { typeId: 'customer', id: customerId }, method: 'card', name: { 'en-US': name },
      paymentInterface: 'stripe', interfaceAccount: 'acct_MOCK_SECRET', token: { value: 'tok_MOCK_SECRET_VALUE' }, paymentMethodStatus: 'Active', default: isDefault,
      createdAt: ago(10 - METHODS.size), lastModifiedAt: now(),
    };
    METHODS.set(m.id, m);
  };
  addMethod('cust-1', 'Visa ending 4242', true);
  addMethod('cust-1', 'Mastercard ending 4444', false);

  /** Applies customer update actions (the subset the storefront sends). */
  function updateCustomer(c, body) {
    const byKey = (key) => c.addresses.find((a) => a.key === key);
    for (const a of body.actions ?? []) {
      switch (a.action) {
        case 'setFirstName': c.firstName = a.firstName; break;
        case 'setLastName': c.lastName = a.lastName; break;
        case 'addAddress': addrSeq += 1; c.addresses.push({ ...a.address, id: `addr-${addrSeq}` }); break;
        case 'addShippingAddressId': c.shippingAddressIds = [...(c.shippingAddressIds ?? []), (byKey(a.addressKey) ?? { id: a.addressId }).id]; break;
        case 'addBillingAddressId': c.billingAddressIds = [...(c.billingAddressIds ?? []), (byKey(a.addressKey) ?? { id: a.addressId }).id]; break;
        case 'setDefaultShippingAddress': c.defaultShippingAddressId = (a.addressKey ? byKey(a.addressKey) : { id: a.addressId })?.id; break;
        case 'setDefaultBillingAddress': c.defaultBillingAddressId = (a.addressKey ? byKey(a.addressKey) : { id: a.addressId })?.id; break;
        case 'changeAddress': {
          const i = c.addresses.findIndex((x) => x.id === a.addressId);
          if (i < 0) return { error: 'InvalidOperation' };
          c.addresses[i] = { ...a.address, id: a.addressId };
          break;
        }
        case 'removeAddress':
          c.addresses = c.addresses.filter((x) => x.id !== a.addressId);
          c.shippingAddressIds = (c.shippingAddressIds ?? []).filter((x) => x !== a.addressId);
          c.billingAddressIds = (c.billingAddressIds ?? []).filter((x) => x !== a.addressId);
          if (c.defaultShippingAddressId === a.addressId) delete c.defaultShippingAddressId;
          if (c.defaultBillingAddressId === a.addressId) delete c.defaultBillingAddressId;
          break;
        default: return { error: 'InvalidOperation', message: `unsupported action ${a.action}` };
      }
    }
    c.version += 1;
    c.lastModifiedAt = now();
    return {};
  }

  async function route(req, res, url, path) {
    const base = `/${PROJECT}`;
    // ---- hooks
    if (path === '/__mock/account') return json(res, 200, { orders: [...ORDERS.values()], lists: [...LISTS.values()], methods: [...METHODS.values()] });
    if (path === '/__mock/order' && req.method === 'POST') {
      const b = await readBody(req);
      const o = orderBy(b.orderNumber);
      if (!o) return notFound(res);
      if (b.state) o.state = stateRef(b.state);
      if (b.shipmentState) o.shipmentState = b.shipmentState;
      if (b.deliver) {
        const info = (o.shippingInfo ??= { deliveries: [] });
        (info.deliveries ??= []).push({ id: `d${info.deliveries.length + 1}`, createdAt: now(), items: b.deliver.items, parcels: [{ id: 'p', createdAt: now(), trackingData: { trackingId: b.deliver.trackingId ?? 'MOCK-TRK', carrier: 'UPS' } }] });
      }
      if (b.returnState) for (const r of o.returnInfo ?? []) for (const i of r.items) Object.assign(i, b.returnState);
      o.version += 1;
      o.lastModifiedAt = now();
      return json(res, 200, o);
    }
    // ---- states
    if (path === `${base}/states` && req.method === 'GET') return json(res, 200, list(STATES));
    // ---- orders (the verified-purchase lookup of M keeps var.p and falls through)
    if (path === `${base}/orders` && req.method === 'GET') {
      if (url.searchParams.get('var.p')) return false;
      if (/orderNumber in/.test(url.searchParams.get('where') ?? '')) return false; // the linked-orders lookup of K (mock-orders.mjs)
      return json(res, 200, filterOrders(url));
    }
    const byNumber = new RegExp(`^${base}/orders/order-number=([^/]+)$`).exec(path);
    if (byNumber && req.method === 'GET') {
      const o = orderBy(decodeURIComponent(byNumber[1]));
      return o ? json(res, 200, o) : false; // not ours: K's placed orders (mock-orders.mjs) answer next
    }
    const orderMatch = new RegExp(`^${base}/orders/([^/]+)$`).exec(path);
    if (orderMatch) {
      const o = ORDERS.get(orderMatch[1]);
      if (!o) return false; // not ours: K's placed orders (mock-orders.mjs) answer next
      if (req.method === 'GET') return json(res, 200, o);
      if (req.method === 'POST') return updateOrder(o, await readBody(req)) ? json(res, 200, o) : conflict(res);
    }
    // ---- customers: updates, password, delete (reads stay in the server's own customer routes)
    if (path === `${base}/customers/password` && req.method === 'POST') {
      const b = await readBody(req);
      const entry = customerById(b.id);
      if (!entry) return notFound(res);
      if (b.version !== entry.customer.version) return conflict(res);
      if (entry.password !== b.currentPassword) return bad(res, 'InvalidCurrentPassword', 'The current password is invalid.');
      entry.password = b.newPassword;
      entry.customer.version += 1;
      return json(res, 200, entry.customer);
    }
    const custMatch = new RegExp(`^${base}/customers/([^/]+)$`).exec(path);
    if (custMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      const entry = customerById(custMatch[1]);
      if (!entry) return notFound(res);
      const c = entry.customer;
      if (req.method === 'DELETE') {
        if (Number(url.searchParams.get('version')) !== c.version) return conflict(res);
        CUSTOMERS.delete(c.email.toLowerCase());
        return json(res, 200, c);
      }
      const body = await readBody(req);
      if (body.version !== c.version) return conflict(res);
      const out = updateCustomer(c, body);
      return out.error ? bad(res, out.error, out.message) : json(res, 200, c);
    }
    // ---- shopping lists
    if (path === `${base}/shopping-lists`) {
      if (req.method === 'GET') {
        const c = url.searchParams.get('var.c');
        const results = [...LISTS.values()].filter((l) => l.customer.id === c).slice(0, Number(url.searchParams.get('limit') ?? 20));
        return json(res, 200, list(results));
      }
      if (req.method === 'POST') {
        const b = await readBody(req);
        if ([...LISTS.values()].some((l) => l.key === b.key)) return bad(res, 'DuplicateField', 'duplicate key');
        listSeq += 1;
        const l = { id: `sl-${listSeq}`, version: 1, key: b.key, customer: b.customer, name: b.name, lineItems: [], textLineItems: [] };
        LISTS.set(l.id, l);
        return json(res, 201, l);
      }
    }
    const listMatch = new RegExp(`^${base}/shopping-lists/([^/]+)$`).exec(path);
    if (listMatch) {
      const l = LISTS.get(listMatch[1]);
      if (!l) return notFound(res);
      if (req.method === 'GET') return json(res, 200, l);
      if (req.method === 'POST') {
        const b = await readBody(req);
        if (b.version !== l.version) return conflict(res);
        for (const a of b.actions ?? []) {
          if (a.action === 'addLineItem') {
            const item = lineItemOf(a.productId, a.variantId);
            if (!item) return bad(res, 'InvalidField', 'unknown product');
            l.lineItems.push(item);
          } else if (a.action === 'removeLineItem') l.lineItems = l.lineItems.filter((x) => x.id !== a.lineItemId);
          else return bad(res, 'InvalidOperation', `unsupported action ${a.action}`);
        }
        l.version += 1;
        return json(res, 200, l);
      }
    }
    // ---- payment methods
    if (path === `${base}/payment-methods` && req.method === 'GET') {
      const c = url.searchParams.get('var.c');
      return json(res, 200, list([...METHODS.values()].filter((m) => m.customer.id === c && m.paymentMethodStatus === 'Active')));
    }
    const pmMatch = new RegExp(`^${base}/payment-methods/([^/]+)$`).exec(path);
    if (pmMatch) {
      const m = METHODS.get(pmMatch[1]);
      if (!m) return notFound(res);
      if (req.method === 'GET') return json(res, 200, m);
      if (req.method === 'POST') {
        const b = await readBody(req);
        if (b.version !== m.version) return conflict(res);
        for (const a of b.actions ?? []) {
          if (a.action === 'setDefault') m.default = a.default;
          else if (a.action === 'setPaymentMethodStatus') {
            if (m.default && a.paymentMethodStatus === 'Inactive') return bad(res, 'InvalidOperation', 'A default Payment Method cannot be set as inactive');
            m.paymentMethodStatus = a.paymentMethodStatus;
          } else return bad(res, 'InvalidOperation', `unsupported action ${a.action}`);
        }
        m.version += 1;
        return json(res, 200, m);
      }
    }
    return false;
  }

  return { route };
}
