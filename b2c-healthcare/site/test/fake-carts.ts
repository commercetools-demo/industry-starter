
/**
 * Minimal in-memory stand-in for the commercetools carts endpoint (tests only): create, get by id, query by
 * customer, and the update actions the cart workstream uses. It does the arithmetic the platform would do, so a
 * test can assert that the app shows the platform's numbers, not its own.
 */
interface FakeMoney {
  type: 'centPrecision';
  currencyCode: string;
  centAmount: number;
  fractionDigits: number;
}
interface FakeLine {
  id: string;
  productId: string;
  name: Record<string, string>;
  variant: { id: number; sku?: string };
  price: { id: string; value: FakeMoney };
  quantity: number;
  totalPrice: FakeMoney;
  custom?: { type: { typeId: string; id: string; key?: string }; fields: Record<string, unknown> };
}
/** The part of a platform cart the fake keeps (shaped like the SDK's `Cart`; the SDK types are not allowed in tests). */
export interface MutableCart {
  id: string;
  version: number;
  cartState: string;
  customerId?: string;
  lineItems: FakeLine[];
  totalPrice: FakeMoney;
  shippingInfo?: { shippingMethodName: string; price: FakeMoney };
}
type CtCart = MutableCart;
type Mut<T> = T;
type LineItem = FakeLine;

export interface FakeCarts {
  carts: Map<string, MutableCart>;
  /** Prices by SKU in cents; change one to simulate a price change on the platform. */
  prices: Map<string, number>;
  /** Every update request body, in order. */
  updates: { id: string; version: number; actions: { action: string; [k: string]: unknown }[] }[];
  creates: unknown[];
  /** When set, the next update fails once with this error. */
  failNextUpdate: unknown;
  apiRoot: { carts: () => unknown };
}

const money = (centAmount: number, currencyCode = 'USD') => ({ type: 'centPrecision' as const, currencyCode, centAmount, fractionDigits: 2 });

export function createFakeCarts(prices: Record<string, number> = {}): FakeCarts {
  const state: FakeCarts = {
    carts: new Map(),
    prices: new Map(Object.entries(prices)),
    updates: [],
    creates: [],
    failNextUpdate: undefined,
    apiRoot: { carts: () => api },
  };
  let seq = 0;

  const priceOf = (sku: string): number => {
    const cents = state.prices.get(sku);
    if (cents === undefined) throw { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
    return cents;
  };

  const lineItem = (sku: string, quantity: number, custom: LineItem['custom']): Mut<LineItem> => {
    seq += 1;
    const cents = priceOf(sku);
    return {
      id: `li-${seq}`,
      productId: `p-${sku}`,
      name: { 'en-US': `Name of ${sku}` },
      variant: { id: 1, sku },
      price: { id: `pr-${sku}`, value: money(cents) },
      quantity,
      totalPrice: money(cents * quantity),
      ...(custom ? { custom } : {}),
    } as unknown as Mut<LineItem>;
  };

  const reprice = (cart: MutableCart, refresh: boolean): MutableCart => {
    for (const item of refresh ? cart.lineItems : []) {
      const sku = item.variant.sku ?? '';
      const cents = priceOf(sku);
      item.price = { ...item.price, value: money(cents) };
      item.totalPrice = money(cents * item.quantity);
    }
    for (const item of cart.lineItems) item.totalPrice = money(item.price.value.centAmount * item.quantity);
    const subtotal = cart.lineItems.reduce((s, i) => s + i.totalPrice.centAmount, 0);
    const shipping = cart.shippingInfo?.price.centAmount ?? 0;
    cart.totalPrice = money(subtotal + shipping);
    return cart;
  };

  function apply(cart: MutableCart, a: { action: string; [k: string]: unknown }): void {
    if (a.action === 'removeLineItem') {
      const before = cart.lineItems.length;
      cart.lineItems = cart.lineItems.filter((i) => i.id !== a.lineItemId);
      if (cart.lineItems.length === before) throw { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
    } else if (a.action === 'addLineItem') {
      const custom = a.custom as { type: { key: string }; fields: Record<string, unknown> };
      cart.lineItems.push(lineItem(String(a.sku), Number(a.quantity), { type: { typeId: 'type', id: 't', ...custom.type }, fields: custom.fields } as LineItem['custom']));
    } else if (a.action === 'setLineItemCustomField') {
      const item = cart.lineItems.find((i) => i.id === a.lineItemId);
      if (!item?.custom) throw { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
      (item.custom.fields as Record<string, unknown>)[String(a.name)] = a.value;
    } else if (a.action !== 'recalculate') {
      throw { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
    }
  }

  const notFound = () => ({ statusCode: 404 });
  const api = {
    get: ({ queryArgs }: { queryArgs?: Record<string, unknown> } = {}) => ({
      execute: async () => {
        const id = queryArgs?.['var.id'];
        const results = [...state.carts.values()].filter((c) => c.customerId === id && c.cartState === 'Active');
        return { body: { results, count: results.length } };
      },
    }),
    post: ({ body }: { body: Record<string, unknown> }) => ({
      execute: async () => {
        state.creates.push(body);
        seq += 1;
        const method = body.shippingMethod ? { price: money(0), shippingMethodName: 'Standard delivery' } : undefined;
        const cart = {
          id: `cart-${seq}`,
          version: 1,
          cartState: 'Active',
          customerId: body.customerId,
          lineItems: [],
          totalPrice: money(0, String(body.currency)),
          ...(method ? { shippingInfo: method } : {}),
        } as unknown as MutableCart;
        state.carts.set(cart.id, cart);
        return { body: structuredClone(cart) };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({
        execute: async () => {
          const cart = state.carts.get(ID);
          if (!cart) throw notFound();
          return { body: structuredClone(cart) };
        },
      }),
      post: ({ body }: { body: { version: number; actions: { action: string; [k: string]: unknown }[] } }) => ({
        execute: async () => {
          const cart = state.carts.get(ID);
          if (!cart) throw notFound();
          if (state.failNextUpdate) {
            const error = state.failNextUpdate;
            state.failNextUpdate = undefined;
            throw error;
          }
          if (body.version !== cart.version) throw { statusCode: 409 };
          state.updates.push({ id: ID, version: body.version, actions: body.actions });
          const next = structuredClone(cart);
          for (const a of body.actions) apply(next, a);
          reprice(next, body.actions.some((a) => a.action === 'recalculate'));
          next.version += 1;
          state.carts.set(ID, next);
          return { body: structuredClone(next) };
        },
      }),
    }),
  };
  return state;
}
