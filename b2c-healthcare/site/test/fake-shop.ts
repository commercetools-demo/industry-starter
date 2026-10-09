/**
 * In-memory stand-in for the commercetools endpoints checkout uses (tests only): carts with an address, shipping
 * methods that match a cart (zones by state), tax by state, orders created from a cart, and order state changes.
 * It does the arithmetic the platform would do, so a test can assert the app shows the platform's numbers.
 * Never the network; the SDK types are not imported in tests.
 */
interface Money {
  type: 'centPrecision';
  currencyCode: string;
  centAmount: number;
  fractionDigits: number;
}
export const usd = (centAmount: number): Money => ({ type: 'centPrecision', currencyCode: 'USD', centAmount, fractionDigits: 2 });

export interface ShopLine {
  id: string;
  productId: string;
  name: Record<string, string>;
  variant: { id: number; sku: string };
  price: { id: string; value: Money };
  /** `ExternalPrice` after `setLineItemPrice` with an external price. */
  priceMode?: 'Platform' | 'ExternalPrice';
  /** What the platform price of the line is (list), for reverting an external price in the fake. */
  listCents?: number;
  quantity: number;
  totalPrice: Money;
  custom?: { type: { typeId: 'type'; id: string; key?: string }; fields: Record<string, unknown> };
}

export interface ShopCart {
  id: string;
  version: number;
  cartState: 'Active' | 'Ordered';
  customerId: string;
  lineItems: ShopLine[];
  totalPrice: Money;
  taxedPrice?: { totalNet: Money; totalGross: Money; totalTax: Money };
  shippingAddress?: Record<string, string>;
  shippingInfo?: { shippingMethodName: string; price: Money; shippingMethod: { typeId: 'shipping-method'; id: string; obj: { key: string } } };
  paymentInfo?: { payments: { typeId: 'payment'; id: string }[] };
}

export interface ShopPayment {
  id: string;
  version: number;
  createdAt: string;
  amountPlanned: Money;
  paymentMethodInfo: { paymentInterface?: string; method?: string };
  customer?: { typeId: 'customer'; id: string };
  transactions: { id: string; type: string; state: string; amount: Money }[];
}

export interface ShopOrder {
  id: string;
  version: number;
  paymentInfo?: { payments: { typeId: 'payment'; id: string }[] };
  custom?: { type: { key: string }; fields: Record<string, unknown> };
  orderNumber?: string;
  customerId: string;
  state?: { typeId: 'state'; key: string; obj: { key: string } };
  cart: { typeId: 'cart'; id: string };
  lineItems: ShopLine[];
  totalPrice: Money;
  taxedPrice?: ShopCart['taxedPrice'];
  shippingAddress?: Record<string, string>;
}

interface MethodDef {
  key: string;
  name: string;
  cents: number;
  /** States served; `null` = everywhere. */
  states: string[] | null;
}

export interface FakeShop {
  carts: Map<string, ShopCart>;
  orders: ShopOrder[];
  /** Payments created through the API (tender payments of workstream U). */
  payments: Map<string, ShopPayment>;
  methods: MethodDef[];
  /** Sales tax in percent by state code (default 0). */
  taxPercent: Record<string, number>;
  /** States no method serves. */
  unserved: Set<string>;
  /** When set, the next order creation fails once with this error. */
  failNextOrder: unknown;
  /** When true, the next order is created but the answer is lost (the call throws a 500). */
  loseNextOrderAnswer: boolean;
  /** Every cart update request, in order. */
  updates: { id: string; version: number; actions: { action: string; [k: string]: unknown }[] }[];
  orderCreates: unknown[];
  matchingCalls: string[];
  seedCart: (over?: Partial<ShopCart> & { lines?: { sku: string; cents: number; rxNumber?: string; lineRef?: string; /** copied hsaEligible */ eligible?: boolean; /** external price (what the patient owes) */ owed?: number; covered?: number }[]; methodKey?: string }) => ShopCart;
  apiRoot: unknown;
}

const err = (statusCode: number, code: string) => ({ statusCode, body: { errors: [{ code }] } });

export function createFakeShop(): FakeShop {
  let seq = 0;
  const shop = {
    carts: new Map<string, ShopCart>(),
    orders: [] as ShopOrder[],
    payments: new Map<string, ShopPayment>(),
    methods: [
      { key: 'mlv-standard', name: 'Standard delivery', cents: 0, states: null },
      { key: 'mlv-same-day', name: 'Same-day delivery', cents: 500, states: ['NY', 'TX', 'IL'] },
    ] as MethodDef[],
    taxPercent: {} as Record<string, number>,
    unserved: new Set<string>(),
    failNextOrder: undefined as unknown,
    loseNextOrderAnswer: false,
    updates: [] as FakeShop['updates'],
    orderCreates: [] as unknown[],
    matchingCalls: [] as string[],
  } as FakeShop;

  const serves = (m: MethodDef, cart: ShopCart): boolean => {
    const state = cart.shippingAddress?.state;
    if (!cart.shippingAddress || cart.shippingAddress.country !== 'US' || (state && shop.unserved.has(state))) return false;
    // Country-only address (the cart as created): matches the country-wide zone only.
    return m.states === null || (state !== undefined && m.states.includes(state));
  };

  const recalc = (cart: ShopCart): void => {
    for (const l of cart.lineItems) l.totalPrice = usd(l.price.value.centAmount * l.quantity);
    // A method that no longer matches the address is dropped, as the platform would on the next read.
    const chosen = cart.shippingInfo && shop.methods.find((m) => m.key === cart.shippingInfo?.shippingMethod.obj.key);
    if (cart.shippingInfo && (!chosen || !serves(chosen, cart))) delete cart.shippingInfo;
    const subtotal = cart.lineItems.reduce((s, l) => s + l.totalPrice.centAmount, 0);
    const shipping = cart.shippingInfo?.price.centAmount ?? 0;
    const net = subtotal + shipping;
    cart.totalPrice = usd(net);
    const rate = shop.taxPercent[cart.shippingAddress?.state ?? ''] ?? 0;
    if (cart.shippingAddress) {
      const tax = Math.round((net * rate) / 100);
      cart.taxedPrice = { totalNet: usd(net), totalGross: usd(net + tax), totalTax: usd(tax) };
    } else delete cart.taxedPrice;
  };

  shop.seedCart = (over = {}) => {
    seq += 1;
    const { lines = [{ sku: 'MED-ator', cents: 1875, rxNumber: 'RX-77102', lineRef: 'RX-77102-1' }], methodKey = 'mlv-standard', ...rest } = over;
    const method = shop.methods.find((m) => m.key === methodKey)!;
    const cart: ShopCart = {
      id: `cart-${seq}`,
      version: 1,
      cartState: 'Active',
      customerId: 'c-sam',
      lineItems: lines.map((l, i) => ({
        id: `li-${seq}-${i}`,
        productId: `p-${l.sku}`,
        name: { 'en-US': `Name of ${l.sku}` },
        variant: { id: 1, sku: l.sku },
        price: { id: `pr-${l.sku}`, value: usd(l.owed ?? l.cents) },
        listCents: l.cents,
        ...(l.owed !== undefined ? { priceMode: 'ExternalPrice' as const } : {}),
        quantity: 1,
        totalPrice: usd(l.owed ?? l.cents),
        custom: {
          type: { typeId: 'type', id: 't', key: 'mlv-rx-line' },
          fields: { rxNumber: l.rxNumber ?? 'RX-77102', rxLineRef: l.lineRef ?? `RX-77102-${i + 1}`, prescribedQty: 30, ...(l.eligible !== undefined ? { eligibleForRestricted: l.eligible } : {}), ...(l.covered !== undefined ? { coveredAmount: { currencyCode: 'USD', centAmount: l.covered } } : {}) },
        },
      })),
      totalPrice: usd(0),
      shippingInfo: { shippingMethodName: method.name, price: usd(method.cents), shippingMethod: { typeId: 'shipping-method', id: `sm-${method.key}`, obj: { key: method.key } } },
      shippingAddress: { country: 'US' },
      ...rest,
    };
    recalc(cart);
    shop.carts.set(cart.id, cart);
    return cart;
  };

  function apply(cart: ShopCart, a: { action: string; [k: string]: unknown }): void {
    if (a.action === 'setShippingAddress') {
      cart.shippingAddress = { country: 'US', ...(a.address as Record<string, string>) };
    } else if (a.action === 'setShippingMethod') {
      const ref = a.shippingMethod as { key: string } | undefined;
      if (!ref) {
        delete cart.shippingInfo;
        return;
      }
      const m = shop.methods.find((x) => x.key === ref.key);
      if (!m || !serves(m, cart)) throw err(400, 'InvalidOperation');
      cart.shippingInfo = { shippingMethodName: m.name, price: usd(m.cents), shippingMethod: { typeId: 'shipping-method', id: `sm-${m.key}`, obj: { key: m.key } } };
    } else if (a.action === 'setLineItemCustomField') {
      const item = cart.lineItems.find((i) => i.id === a.lineItemId);
      if (!item?.custom) throw err(400, 'InvalidOperation');
      item.custom.fields[String(a.name)] = a.value;
    } else if (a.action === 'addPayment') {
      const ref = a.payment as { id: string };
      cart.paymentInfo = { payments: [...(cart.paymentInfo?.payments ?? []), { typeId: 'payment', id: ref.id }] };
    } else if (a.action === 'removePayment') {
      const ref = a.payment as { id: string };
      cart.paymentInfo = { payments: (cart.paymentInfo?.payments ?? []).filter((p) => p.id !== ref.id) };
    } else if (a.action === 'setLineItemPrice') {
      const item = cart.lineItems.find((i) => i.id === a.lineItemId);
      if (!item) throw err(400, 'InvalidOperation');
      const external = a.externalPrice as { centAmount: number } | undefined;
      if (external) {
        item.priceMode = 'ExternalPrice';
        item.price = { ...item.price, value: usd(external.centAmount) };
      } else {
        item.priceMode = 'Platform';
        item.price = { ...item.price, value: usd(item.listCents ?? item.price.value.centAmount) };
      }
    } else if (a.action !== 'recalculate') throw err(400, 'InvalidOperation');
  }

  const cartApi = {
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({
        execute: async () => {
          const cart = shop.carts.get(ID);
          if (!cart) throw { statusCode: 404 };
          return { body: structuredClone(cart) };
        },
      }),
      post: ({ body }: { body: { version: number; actions: { action: string; [k: string]: unknown }[] } }) => ({
        execute: async () => {
          const cart = shop.carts.get(ID);
          if (!cart) throw { statusCode: 404 };
          if (body.version !== cart.version) throw { statusCode: 409 };
          if (cart.cartState !== 'Active') throw err(400, 'InvalidOperation');
          shop.updates.push({ id: ID, version: body.version, actions: body.actions });
          const next = structuredClone(cart);
          for (const a of body.actions) apply(next, a);
          recalc(next);
          next.version += 1;
          shop.carts.set(ID, next);
          return { body: structuredClone(next) };
        },
      }),
    }),
    get: ({ queryArgs }: { queryArgs?: Record<string, unknown> } = {}) => ({
      execute: async () => {
        const results = [...shop.carts.values()].filter((c) => c.customerId === queryArgs?.['var.id'] && c.cartState === 'Active');
        return { body: { results } };
      },
    }),
  };

  const orderApi = {
    post: ({ body }: { body: { cart: { id: string }; version: number; orderNumber?: string; state?: { key: string } } }) => ({
      execute: async () => {
        shop.orderCreates.push(body);
        if (shop.failNextOrder) {
          const error = shop.failNextOrder;
          shop.failNextOrder = undefined;
          throw error;
        }
        const cart = shop.carts.get(body.cart.id);
        if (!cart) throw { statusCode: 404 };
        if (cart.version !== body.version) throw { statusCode: 409 };
        if (cart.cartState !== 'Active') throw err(400, 'InvalidOperation');
        if (body.orderNumber && shop.orders.some((o) => o.orderNumber === body.orderNumber)) throw err(400, 'DuplicateField');
        seq += 1;
        const order: ShopOrder = {
          id: `order-${seq}`,
          version: 1,
          ...(body.orderNumber ? { orderNumber: body.orderNumber } : {}),
          customerId: cart.customerId,
          ...(body.state ? { state: { typeId: 'state', key: body.state.key, obj: { key: body.state.key } } } : {}),
          cart: { typeId: 'cart', id: cart.id },
          ...(cart.paymentInfo ? { paymentInfo: structuredClone(cart.paymentInfo) } : {}),
          lineItems: structuredClone(cart.lineItems),
          totalPrice: cart.totalPrice,
          ...(cart.taxedPrice ? { taxedPrice: cart.taxedPrice } : {}),
          ...(cart.shippingAddress ? { shippingAddress: cart.shippingAddress } : {}),
        };
        shop.orders.push(order);
        cart.cartState = 'Ordered';
        cart.version += 1;
        if (shop.loseNextOrderAnswer) {
          shop.loseNextOrderAnswer = false;
          throw { statusCode: 500 };
        }
        return { body: structuredClone(order) };
      },
    }),
    get: ({ queryArgs }: { queryArgs?: { where?: string } } = {}) => ({
      execute: async () => {
        const where = queryArgs?.where ?? '';
        const m = /^cart\(id="([^"]+)"\)$/.exec(where);
        const own = /^id="([^"]+)" and customerId="([^"]+)"$/.exec(where);
        const byId = /^id="([^"]+)"$/.exec(where);
        const results = shop.orders.filter((o) => (own ? o.id === own[1] && o.customerId === own[2] : byId ? o.id === byId[1] : !m || o.cart.id === m[1])).map((o) => {
          const copy = structuredClone(o) as ShopOrder & { paymentInfo?: { payments: { typeId: 'payment'; id: string; obj?: ShopPayment }[] } };
          // The cancel and order reads expand the payments and the state.
          for (const ref of copy.paymentInfo?.payments ?? []) ref.obj = structuredClone(shop.payments.get(ref.id));
          return copy;
        });
        return { body: { results } };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: ({ queryArgs }: { queryArgs?: { expand?: string[] } } = {}) => ({
        execute: async () => {
          const order = shop.orders.find((o) => o.id === ID);
          if (!order) throw { statusCode: 404 };
          const copy = structuredClone(order) as ShopOrder & { paymentInfo?: { payments: { typeId: 'payment'; id: string; obj?: ShopPayment }[] } };
          if (queryArgs?.expand?.some((e) => e.startsWith('paymentInfo'))) for (const ref of copy.paymentInfo?.payments ?? []) ref.obj = structuredClone(shop.payments.get(ref.id));
          return { body: copy };
        },
      }),
      post: ({ body }: { body: { version: number; actions: { action: string; [k: string]: unknown }[] } }) => ({
        execute: async () => {
          const order = shop.orders.find((o) => o.id === ID);
          if (!order) throw { statusCode: 404 };
          if (body.version !== order.version) throw { statusCode: 409 };
          for (const a of body.actions as { action: string; [k: string]: unknown }[]) {
            if (a.action === 'transitionState' && a.state) order.state = { typeId: 'state', key: (a.state as { key: string }).key, obj: { key: (a.state as { key: string }).key } };
            else if (a.action === 'setOrderNumber') order.orderNumber = String(a.orderNumber);
            else if (a.action === 'setCustomType') order.custom = { type: { key: (a.type as { key: string }).key }, fields: structuredClone(a.fields as Record<string, unknown>) };
            else if (a.action === 'setLineItemCustomField') {
              const line = order.lineItems.find((l) => l.id === a.lineItemId);
              if (line?.custom) line.custom.fields[String(a.name)] = a.value;
            }
          }
          order.version += 1;
          return { body: structuredClone(order) };
        },
      }),
    }),
  };

  const paymentApi = {
    post: ({ body }: { body: { amountPlanned: Money; paymentMethodInfo: ShopPayment['paymentMethodInfo']; customer?: ShopPayment['customer'] } }) => ({
      execute: async () => {
        seq += 1;
        const payment: ShopPayment = { id: `pay-${seq}`, version: 1, createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, seq)).toISOString(), transactions: [], ...structuredClone(body) };
        shop.payments.set(payment.id, payment);
        return { body: structuredClone(payment) };
      },
    }),
    get: ({ queryArgs }: { queryArgs?: { where?: string } } = {}) => ({
      execute: async () => {
        const ids = [...(queryArgs?.where ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        return { body: { results: [...shop.payments.values()].filter((p) => ids.includes(p.id)).map((p) => structuredClone(p)) } };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({
        execute: async () => {
          const p = shop.payments.get(ID);
          if (!p) throw { statusCode: 404 };
          return { body: structuredClone(p) };
        },
      }),
      post: ({ body }: { body: { version: number; actions: { action: string; [k: string]: unknown }[] } }) => ({
        execute: async () => {
          const p = shop.payments.get(ID);
          if (!p) throw { statusCode: 404 };
          if (body.version !== p.version) throw { statusCode: 409 };
          for (const a of body.actions) {
            if (a.action === 'changeAmountPlanned') p.amountPlanned = usd((a.amount as { centAmount: number }).centAmount);
            else if (a.action === 'addTransaction') {
              const t = a.transaction as { type: string; state: string; amount: { centAmount: number } };
              p.transactions.push({ id: `tx-${p.transactions.length + 1}`, type: t.type, state: t.state, amount: usd(t.amount.centAmount) });
            } else throw err(400, 'InvalidOperation');
          }
          p.version += 1;
          return { body: structuredClone(p) };
        },
      }),
    }),
  };

  shop.apiRoot = {
    carts: () => cartApi,
    orders: () => orderApi,
    payments: () => paymentApi,
    shippingMethods: () => ({
      matchingCart: () => ({
        get: ({ queryArgs }: { queryArgs: { cartId: string } }) => ({
          execute: async () => {
            shop.matchingCalls.push(queryArgs.cartId);
            const cart = shop.carts.get(queryArgs.cartId);
            if (!cart) throw { statusCode: 404 };
            const results = shop.methods
              .filter((m) => serves(m, cart))
              .map((m) => ({ id: `sm-${m.key}`, key: m.key, name: m.name, zoneRates: [{ shippingRates: [{ price: usd(m.cents), isMatching: true }] }] }));
            return { body: { results } };
          },
        }),
      }),
    }),
  };
  return shop;
}
