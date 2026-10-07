// A tiny in-memory commercetools cart that applies the update actions the app sends. Prices come from `prices` (sku -> cents); a line
// with `recurrenceInfo` gets the recurring price (and the policy reference) only when the sku has one, like the real price selection.
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { ctCart } from './ctCart';

export interface FakePrice {
  recurring?: number;
  oneTime?: number;
}

export interface FakeCartHandle {
  cart: CtCart;
  /** Every action list received, in order. */
  updates: { version: number; actions: { action: string; [key: string]: unknown }[] }[];
  apply(version: number, actions: { action: string; [key: string]: unknown }[]): CtCart;
}

/** Discount codes the fake knows: `state` is what the engine reports on the cart after `addDiscountCode`. */
export type FakeCodes = Record<string, { id: string; state: string }>;

export function fakeCart(prices: Record<string, FakePrice>, initial: Partial<CtCart> = {}, codes: FakeCodes = {}): FakeCartHandle {
  let counter = 0;
  const handle: FakeCartHandle = {
    cart: { ...ctCart(), anonymousId: 'anon-1', ...initial } as CtCart,
    updates: [],
    apply(version, actions) {
      const current = handle.cart as unknown as {
        version: number;
        lineItems: Record<string, unknown>[];
        customLineItems: Record<string, unknown>[];
        totalPrice: { centAmount: number };
        discountCodes: { discountCode: { id: string; obj?: { code: string } }; state: string }[];
        custom: { fields: Record<string, unknown> };
        shippingAddress?: unknown;
      };
      if (version !== current.version) throw { statusCode: 409 };
      handle.updates.push({ version, actions });
      for (const action of actions) {
        if (action.action === 'addLineItem') {
          const sku = action.sku as string;
          const price = prices[sku] ?? {};
          const recurrenceInfo = action.recurrenceInfo as { priceSelectionMode: string } | undefined;
          const cents = recurrenceInfo ? price.recurring : (price.oneTime ?? price.recurring);
          const quantity = (action.quantity as number | undefined) ?? 1;
          const custom = action.custom as { fields: Record<string, string> } | undefined;
          counter += 1;
          current.lineItems.push({
            id: `line-${counter}`,
            productKey: custom?.fields.offerKey,
            name: { 'en-US': sku },
            variant: { id: 1, sku },
            price: { value: { type: 'centPrecision', centAmount: cents ?? 0, currencyCode: 'USD', fractionDigits: 2 }, ...(recurrenceInfo && price.recurring !== undefined ? { recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-1' } } : {}) },
            quantity,
            totalPrice: { type: 'centPrecision', centAmount: (cents ?? 0) * quantity, currencyCode: 'USD', fractionDigits: 2 },
            discountedPricePerQuantity: [],
            ...(recurrenceInfo ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-1' }, priceSelectionMode: recurrenceInfo.priceSelectionMode } } : {}),
            custom: { fields: custom?.fields ?? {} },
          });
        } else if (action.action === 'removeLineItem') {
          current.lineItems = current.lineItems.filter((line) => line.id !== action.lineItemId);
        } else if (action.action === 'changeLineItemQuantity') {
          const line = current.lineItems.find((candidate) => candidate.id === action.lineItemId);
          if (line) line.quantity = action.quantity;
        } else if (action.action === 'setLineItemCustomField') {
          const line = current.lineItems.find((candidate) => candidate.id === action.lineItemId) as { custom: { fields: Record<string, unknown> } } | undefined;
          if (line) line.custom.fields[action.name as string] = action.value;
        } else if (action.action === 'addCustomLineItem') {
          counter += 1;
          current.customLineItems.push({ id: `fee-${counter}`, name: action.name, slug: action.slug, quantity: action.quantity, money: action.money, totalPrice: action.money });
        } else if (action.action === 'removeCustomLineItem') {
          current.customLineItems = current.customLineItems.filter((item) => item.id !== action.customLineItemId);
        } else if (action.action === 'changeCustomLineItemQuantity') {
          const item = current.customLineItems.find((candidate) => candidate.id === action.customLineItemId);
          if (item) item.quantity = action.quantity;
        } else if (action.action === 'addDiscountCode') {
          const known = codes[action.code as string];
          if (!known) throw { statusCode: 400, body: { errors: [{ code: 'ResourceNotFound' }] } };
          current.discountCodes.push({ discountCode: { id: known.id, obj: { code: action.code as string } }, state: known.state });
        } else if (action.action === 'removeDiscountCode') {
          const id = (action.discountCode as { id: string }).id;
          current.discountCodes = current.discountCodes.filter((entry) => entry.discountCode.id !== id);
        } else if (action.action === 'setCustomField') {
          current.custom.fields[action.name as string] = action.value;
        } else if (action.action === 'setShippingAddress') {
          current.shippingAddress = action.address;
        }
      }
      current.version += 1;
      // The engine total: the sum of the lines (discounts are not simulated here).
      const sum = (items: Record<string, unknown>[]): number => items.reduce((acc, item) => acc + (item.totalPrice as { centAmount: number }).centAmount, 0);
      for (const item of current.lineItems) {
        const unit = (item.price as { value: { centAmount: number } }).value.centAmount;
        item.totalPrice = { type: 'centPrecision', centAmount: unit * (item.quantity as number), currencyCode: 'USD', fractionDigits: 2 };
      }
      for (const item of current.customLineItems) {
        const unit = (item.money as { centAmount: number }).centAmount;
        item.totalPrice = { type: 'centPrecision', centAmount: unit * (item.quantity as number), currencyCode: 'USD', fractionDigits: 2 };
      }
      current.totalPrice = { type: 'centPrecision', centAmount: sum(current.lineItems) + sum(current.customLineItems), currencyCode: 'USD', fractionDigits: 2 } as never;
      return handle.cart;
    },
  };
  return handle;
}
