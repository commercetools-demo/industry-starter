// A tiny in-memory commercetools for the checkout tests: ONE mutable world (cart, orders, shipping methods, session) behind the module
// mocks of `lib/ct/*`. Route and server-function tests mount the real `lib/ct/checkout.ts` on top of it, so a scenario is proven through
// the whole stack (validation order, writes, read-back) without any network.
import type { BundleIssue, Cart, CartLine, Money } from '@/lib/types';
import type { SessionData } from '@/lib/session-types';
import { feeLine, makeCart, phoneLine, planLine, usd } from './cart';

type Json = Record<string, unknown>;

export interface FakeMethod {
  id: string;
  key: string;
  name: string;
  price: number;
}

export interface World {
  ct: Json;
  lines: CartLine[];
  unservableZips: Set<string>;
  eligibilityIssue: boolean;
  methods: FakeMethod[];
  /** An address write drops the chosen shipping method (the platform clears a method that no longer matches). */
  clearMethodOnAddress: boolean;
  orders: Json[];
  session: SessionData;
  actions: Json[][];
  sessionsCreated: { cartId: string; orderNumber: string }[];
  financing: 'approved' | 'declined' | 'sign-in-required';
  deviceIntegrityFails: boolean;
  stamped: string[];
  calls: string[];
  /** The signed-in customer's own email (what `getCustomerById` answers); null = unknown. */
  customerEmail: string | null;
}

export const MARKET = { locale: 'en-US', currency: 'USD', country: 'US' } as const;

export const ADDRESS = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } as const;

export const world: World = {} as World;

export function resetWorld(opts: { lines?: CartLine[]; signedIn?: boolean; recurring?: boolean; pendingOrderNumber?: string } = {}): World {
  const lines = opts.lines ?? [planLine(), feeLine()];
  Object.assign(world, {
    lines,
    unservableZips: new Set<string>(),
    eligibilityIssue: false,
    methods: [
      { id: 'sm-standard', key: 'malva-shipping-standard', name: 'Standard shipping', price: 0 },
      { id: 'sm-digital', key: 'malva-delivery-digital', name: 'Digital delivery', price: 0 },
      { id: 'sm-sample', key: 'standard-shipping', name: 'Sample method', price: 500 },
    ],
    clearMethodOnAddress: false,
    orders: [],
    session: { cartId: 'cart-1', ...(opts.signedIn ? { customerId: 'cust-1' } : { anonymousId: 'anon-1' }), ...(opts.pendingOrderNumber ? { pendingOrderNumber: opts.pendingOrderNumber, pendingCartId: 'cart-1' } : {}) },
    actions: [],
    sessionsCreated: [],
    financing: 'approved',
    deviceIntegrityFails: false,
    stamped: [],
    calls: [],
    customerEmail: null,
    ct: {
      id: 'cart-1',
      version: 1,
      cartState: 'Active',
      ...(opts.signedIn ? { customerId: 'cust-1' } : { anonymousId: 'anon-1' }),
      totalPrice: { centAmount: 0, currencyCode: 'USD' },
      lineItems: lines.filter((line) => line.source === 'line-item').map((line) => ({ id: line.id, ...(opts.recurring === false || line.chargeType !== 'recurring' ? {} : { recurrenceInfo: { policy: 'p' } }) })),
      customLineItems: [],
    },
  } satisfies World);
  return world;
}

const cents = (centAmount: number): Money => usd(centAmount);

function shippingCents(): number {
  const info = world.ct.shippingInfo as { price: Money } | undefined;
  return info?.price.centAmount ?? 0;
}

/** The mapped cart for the world as it is now (what `mapForMarket` would answer). */
export function currentCart(location?: { postalCode: string }): Cart {
  const lineTotal = world.lines.reduce((sum, line) => sum + line.total.centAmount, 0);
  const issues: BundleIssue[] = [];
  const zip = location?.postalCode ?? (world.ct.shippingAddress as { postalCode?: string } | undefined)?.postalCode;
  if (zip && world.unservableZips.has(zip)) {
    for (const line of world.lines.filter((candidate) => candidate.kind === 'plan')) {
      issues.push({ code: 'NOT_SERVICEABLE', severity: 'blocking', lineId: line.id, offerKey: line.offerKey, resolution: 'remove', reasons: [{ code: 'NOT_SERVICEABLE', messageKey: 'offers.reason.NOT_SERVICEABLE', params: {}, offerKeys: [line.offerKey] }] });
    }
  }
  if (world.eligibilityIssue) {
    const line = world.lines[0];
    if (line) issues.push({ code: 'NOT_ELIGIBLE_AUDIENCE', severity: 'blocking', lineId: line.id, offerKey: line.offerKey, resolution: 'remove', reasons: [{ code: 'NOT_ELIGIBLE_AUDIENCE', messageKey: 'm', params: {}, offerKeys: [line.offerKey] }] });
  }
  const cart = makeCart({ lines: world.lines, issues, summary: { total: cents(lineTotal + shippingCents()), tax: world.ct.taxedPrice ? cents(0) : null } });
  return cart;
}

// ---- factories for the module mocks ----

const clone = <T,>(value: T): T => structuredClone(value);

function applyAction(action: Json): void {
  const ct = world.ct;
  switch (action.action) {
    case 'setCustomerEmail':
      ct.customerEmail = action.email;
      break;
    case 'setShippingAddress':
      ct.shippingAddress = action.address;
      ct.taxedPrice = { totalTax: cents(0) };
      if (world.clearMethodOnAddress) delete ct.shippingInfo;
      break;
    case 'setBillingAddress':
      ct.billingAddress = action.address;
      break;
    case 'setShippingMethod': {
      const id = (action.shippingMethod as { id: string }).id;
      const method = world.methods.find((candidate) => candidate.id === id);
      if (method) ct.shippingInfo = { shippingMethod: { typeId: 'shipping-method', id }, shippingMethodName: method.name, price: { centAmount: method.price, currencyCode: 'USD' } };
      break;
    }
    case 'recalculate':
      world.calls.push('recalculate');
      break;
    default:
      break;
  }
}

export function cartMock() {
  return {
    getActiveCartForSession: async (): Promise<Json | null> => {
      const state = world.ct.cartState;
      return state === 'Active' ? world.ct : null;
    },
    updateCart: async (_cart: unknown, actions: Json[]): Promise<Json> => {
      world.actions.push(actions);
      for (const action of actions) applyAction(action);
      world.ct.version = (world.ct.version as number) + 1;
      const total = world.lines.reduce((sum, line) => sum + line.total.centAmount, 0) + shippingCents();
      world.ct.totalPrice = { centAmount: total, currencyCode: 'USD' };
      return world.ct;
    },
    statusOf: (error: unknown): number | undefined => (typeof error === 'object' && error !== null && 'statusCode' in error ? (error as { statusCode: number }).statusCode : undefined),
  };
}

export function bundleMock() {
  return {
    mapForMarket: async (ct: Json, _market: unknown, location?: { postalCode: string }) => ({ cart: currentCart(location), ct }),
  };
}

export function serviceabilityMock() {
  return { getServiceability: () => ({ check: async (postalCode: string, country: string) => ({ postalCode, country, served: { cable: true, 'fixed-wireless': true, mobile: true }, anyServed: true, checkedAt: 'now' }) }) };
}

const notFound = () => Object.assign(new Error('not found'), { statusCode: 404 });

export function clientMock() {
  const orderOf = (predicate: (order: Json) => boolean) => ({
    get: () => ({
      execute: async () => {
        const found = world.orders.find(predicate);
        if (!found) throw notFound();
        return { body: clone(found) };
      },
    }),
  });
  return {
    getApiRoot: () => ({
      shippingMethods: () => ({
        matchingCart: () => ({
          get: () => ({
            execute: async () => ({
              body: {
                results: world.methods.map((method) => ({ id: method.id, key: method.key, name: method.name, zoneRates: [{ shippingRates: [{ price: { centAmount: method.price, currencyCode: 'USD' }, isMatching: true }] }] })),
              },
            }),
          }),
        }),
      }),
      orders: () => ({
        withOrderNumber: ({ orderNumber }: { orderNumber: string }) => orderOf((order) => order.orderNumber === orderNumber),
        withId: ({ ID }: { ID: string }) => orderOf((order) => order.id === ID),
        post: ({ body }: { body: { cart: { id: string }; orderNumber: string; paymentState?: string } }) => ({
          execute: async () => {
            if (world.orders.some((order) => order.orderNumber === body.orderNumber)) throw Object.assign(new Error('dup'), { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } });
            const order: Json = {
              id: `order-${world.orders.length + 1}`,
              orderNumber: body.orderNumber,
              orderState: 'Open',
              paymentState: body.paymentState,
              createdAt: '2026-10-07T10:00:00.000Z',
              cart: { typeId: 'cart', id: body.cart.id },
              customerId: world.ct.customerId,
              customerEmail: world.ct.customerEmail,
              totalPrice: world.ct.totalPrice,
              lineItems: [],
              customLineItems: [],
            };
            world.orders.push(order);
            world.ct.cartState = 'Ordered';
            return { body: order };
          },
        }),
      }),
    }),
  };
}

export function devicesMock() {
  return {
    assertDeviceCartIntegrity: async () => {
      if (world.deviceIntegrityFails) throw Object.assign(new Error('price'), { code: 'PRICE_NOT_FOR_TERM' });
    },
    evaluateFinancing: async () => ({ decisionId: 'd1', outcome: world.financing, reason: world.financing === 'declined' ? 'customer-declined' : 'ok', financedTotal: cents(0), limit: cents(250000), decidedAt: '2026-10-07T10:00:00Z' }),
    applyDeviceRecurringExpiry: async () => ({ applied: [], skipped: [], polls: 0 }),
  };
}

export function stampMock() {
  return {
    stampOrderPricing: async (orderId: string) => {
      world.stamped.push(orderId);
      const order = world.orders.find((candidate) => candidate.id === orderId);
      if (order) order.custom = { fields: { serviceStartDate: '2026-10-12', priceSchedule: '{}', labelSnapshot: '{}' } };
      return { priceSchedule: '{}', labelSnapshot: '{}', serviceStartDate: '2026-10-12', errors: [] };
    },
  };
}

export function checkoutSessionMock() {
  class CheckoutSessionError extends Error {
    constructor(
      readonly code: string,
      readonly status?: number,
    ) {
      super(code);
    }
  }
  return {
    CheckoutSessionError,
    createCheckoutSession: async (cartId: string, orderNumber: string) => {
      world.sessionsCreated.push({ cartId, orderNumber });
      return { sessionId: `sess-${world.sessionsCreated.length}`, projectKey: 'proj', region: 'us-central1.gcp' };
    },
  };
}

export function sessionMock() {
  return {
    getSession: async () => ({ ...world.session }),
    updateSession: async (patch: Partial<SessionData>) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete (world.session as Record<string, unknown>)[key];
        else (world.session as Record<string, unknown>)[key] = value;
      }
      return world.session;
    },
  };
}

export function customerMock() {
  return { getCustomerById: async () => (world.customerEmail ? { id: 'cust-1', email: world.customerEmail } : null) };
}

export function marketMock() {
  return { getMarket: async () => ({ ...MARKET }) };
}

/** A same-origin JSON request for a route handler. */
export function post(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost' }, body: JSON.stringify(body) });
}

export function get(url: string): Request {
  return new Request(`http://localhost${url}`, { headers: { host: 'localhost' } });
}

export { feeLine, makeCart, phoneLine, planLine };
