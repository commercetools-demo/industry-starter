// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Orders, the Checkout Sessions API and a stand-in for "the hosted Checkout finished" (workstream K), for the local mock server.
// The real hosted Checkout creates the order itself when payment succeeds; the mock does that on POST /__mock/place-order.
//   POST /__mock/place-order { cartId, orderNumber, email?, address?: {firstName,lastName,...} }   -> the order (state: none, like the platform)
//   GET  /__mock/orders                                   -> every order the mock holds
//   GET  /<project>/orders/<id> and /orders/order-number=<n>, GET /<project>/orders?where=orderNumber in (...)
//   POST /<project>/orders/<id> { actions: [transitionState] }   -> follows the seeded chain ordered, preparing, ready, collected
//   POST /<project>/sessions                                -> a session id (the Sessions API; use CTP_SESSION_URL to point the app here)
// Nothing here is a real credential.

const STATE_CHAIN = ['mcf-order-ordered', 'mcf-order-preparing', 'mcf-order-ready-for-collection', 'mcf-order-collected'];
const ORDERS = new Map();
let seq = 0;

/** The order a finished hosted Checkout would have created from `cart`. */
function orderFromCart(cart, body, deps) {
  seq += 1;
  const policy = (id) => deps.policies.find((p) => p.id === id);
  const lineItems = cart.lineItems.map((l) => ({
    ...l,
    ...(l.supplyChannel ? { supplyChannel: { ...l.supplyChannel, obj: deps.stores.find((s) => s.id === l.supplyChannel.id) } } : {}),
    ...(l.recurrenceInfo
      ? { recurrenceInfo: { ...l.recurrenceInfo, recurrencePolicy: { ...l.recurrenceInfo.recurrencePolicy, obj: policy(l.recurrenceInfo.recurrencePolicy.id) } } }
      : {}),
  }));
  const info = cart.shippingInfo
    ? {
        ...cart.shippingInfo,
        ...(cart.shippingInfo.shippingMethod?.obj?.key === 'mcf-ship-standard'
          ? { shippingMethod: { ...cart.shippingInfo.shippingMethod, obj: { key: 'mcf-ship-standard', localizedDescription: { 'en-US': '2-4 business days', 'en-CA': '2-4 business days' } } } }
          : {}),
        deliveries: [],
      }
    : undefined;
  const order = {
    id: `ord-${seq}`, version: 1, orderNumber: body.orderNumber, createdAt: new Date().toISOString(), lastModifiedAt: new Date().toISOString(),
    locale: cart.locale, country: cart.country, customerEmail: body.email ?? 'guest@example.com', ...(cart.customerId ? { customerId: cart.customerId } : {}),
    ...(cart.anonymousId ? { anonymousId: cart.anonymousId } : {}),
    lineItems, totalPrice: cart.totalPrice, ...(cart.taxedPrice ? { taxedPrice: cart.taxedPrice } : {}),
    ...(info ? { shippingInfo: info } : {}), shippingAddress: body.address ?? cart.shippingAddress ?? { country: cart.country },
    orderState: 'Open', paymentState: 'Paid', shipmentState: 'Pending',
  };
  ORDERS.set(order.id, order);
  cart.cartState = 'Ordered';
  return order;
}

const notFound = (json, res) => json(res, 404, { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound' }] });

/** Returns false when the path is not an order, session or order-hook route. `deps`: { CARTS, stores, policies, json, readBody, project }. */
export async function orderRoutes(req, res, url, path, deps) {
  const { CARTS, json, readBody, project } = deps;
  if (path === '/__mock/place-order' && req.method === 'POST') {
    const body = await readBody(req);
    const cart = CARTS.get(body.cartId);
    if (!cart) return notFound(json, res);
    if (ORDERS.size && [...ORDERS.values()].some((o) => o.orderNumber === body.orderNumber)) {
      return json(res, 409, { statusCode: 409, message: 'duplicate order number', errors: [{ code: 'DuplicateField', field: 'orderNumber' }] });
    }
    return json(res, 201, orderFromCart(cart, body, deps));
  }
  if (path === '/__mock/orders') return json(res, 200, [...ORDERS.values()]);
  if (path === `/${project}/sessions` && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.cart?.cartRef?.id || !CARTS.has(body.cart.cartRef.id)) return json(res, 400, { statusCode: 400, message: 'unknown cart', errors: [{ code: 'InvalidInput' }] });
    return json(res, 201, { id: `mock-session-${(seq += 1)}`, expiryAt: new Date(Date.now() + 3600_000).toISOString(), metadata: body.metadata });
  }
  if (path === `/${project}/orders` && req.method === 'GET' && /orderNumber/.test(url.searchParams.get('where') ?? '')) {
    const wanted = [...(url.searchParams.get('where') ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const results = [...ORDERS.values()].filter((o) => wanted.includes(o.orderNumber));
    return json(res, 200, { limit: 20, offset: 0, count: results.length, total: results.length, results });
  }
  const byNumber = new RegExp(`^/${project}/orders/order-number=([^/]+)$`).exec(path);
  const byId = new RegExp(`^/${project}/orders/(ord-[^/]+)$`).exec(path);
  if (byNumber || byId) {
    const order = byNumber ? [...ORDERS.values()].find((o) => o.orderNumber === decodeURIComponent(byNumber[1])) : ORDERS.get(byId[1]);
    if (!order) return notFound(json, res);
    if (req.method === 'GET') return json(res, 200, order);
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.version !== order.version) return json(res, 409, { statusCode: 409, message: 'version', errors: [{ code: 'ConcurrentModification' }] });
      for (const action of body.actions ?? []) {
        if (action.action !== 'transitionState') return json(res, 400, { statusCode: 400, message: 'unsupported', errors: [{ code: 'InvalidOperation' }] });
        const from = order.state ? STATE_CHAIN.indexOf(order.state.obj.key) : -1;
        const to = STATE_CHAIN.indexOf(action.state.key);
        if (to < 0 || to !== from + 1) return json(res, 400, { statusCode: 400, message: 'invalid transition', errors: [{ code: 'InvalidOperation' }] });
        order.state = { typeId: 'state', id: `state-${action.state.key}`, obj: { key: action.state.key } };
      }
      order.version += 1;
      return json(res, 200, order);
    }
  }
  return false;
}
