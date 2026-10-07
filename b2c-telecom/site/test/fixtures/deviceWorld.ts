// An in-memory commercetools for the device cart routes: the real route, bundle, cart, guard and mapper code runs against it. Only the
// SDK client (`getApiRoot`) is replaced. It resolves line prices like the platform does: a line with `recurrenceInfo` takes the price
// tied to its policy and silently FALLS BACK to the one-time price when the variant has none (the trap Q guards against).
import { NOVA_5G, NOVA_PRO } from '@/lib/devices/__fixtures__/devices';
import { POLICY_IDS } from '@/lib/devices/__fixtures__/offers';
import type { DeviceVariant } from '@/lib/types';
import { ctCart } from './ctCart';

interface FakeLine {
  id: string;
  addedAt?: string;
  productKey?: string;
  name: Record<string, string>;
  variant: { id: number; sku: string };
  price: { value: { type: string; centAmount: number; currencyCode: string; fractionDigits: number }; recurrencePolicy?: { typeId: string; id: string } };
  quantity: number;
  totalPrice: { type: string; centAmount: number; currencyCode: string; fractionDigits: number };
  discountedPricePerQuantity: unknown[];
  recurrenceInfo?: { recurrencePolicy: { typeId: string; id: string }; priceSelectionMode: string };
  custom: { fields: Record<string, unknown> };
}

interface FakeCart {
  id: string;
  version: number;
  cartState: string;
  country: string;
  anonymousId?: string;
  customerId?: string;
  lineItems: FakeLine[];
  customLineItems: unknown[];
  totalPrice: { type: string; centAmount: number; currencyCode: string; fractionDigits: number };
  discountCodes: unknown[];
  custom: { fields: Record<string, unknown> };
  [key: string]: unknown;
}

const money = (centAmount: number) => ({ type: 'centPrecision', centAmount, currencyCode: 'USD', fractionDigits: 2 });
const variants: DeviceVariant[] = [...NOVA_5G.variants, ...NOVA_PRO.variants];

export const deviceWorld = {
  cart: undefined as FakeCart | undefined,
  /** Every action list received, in order. */
  updates: [] as { version: number; actions: { action: string; [key: string]: unknown }[] }[],
  /** `sku|policyKey` pairs whose price the platform "lost": the line then resolves to the one-time price. */
  lostPrices: new Set<string>(),
  inventory: {} as Record<string, number>,
  created: 0,
  counter: 0,
};

export function resetDeviceWorld(): void {
  deviceWorld.cart = undefined;
  deviceWorld.updates = [];
  deviceWorld.lostPrices = new Set();
  deviceWorld.inventory = Object.fromEntries(variants.map((variant) => [variant.sku, 10]));
  deviceWorld.created = 0;
  deviceWorld.counter = 0;
}

/** A cart that already exists for `anonymousId` (id `cart-1`). */
export function seedDeviceCart(patch: Partial<FakeCart> = {}): FakeCart {
  deviceWorld.cart = { ...(ctCart({ id: 'cart-1', version: 1 }) as unknown as FakeCart), anonymousId: 'anon-1', ...patch };
  return deviceWorld.cart;
}

const policyKeyOfId = (id: string): string | undefined => Object.entries(POLICY_IDS).find(([, value]) => value === id)?.[0];

function priceOf(sku: string, policyKey: string | undefined): { cents: number; policyId?: string } {
  const variant = variants.find((entry) => entry.sku === sku);
  const outright = variant?.prices.outright?.centAmount ?? 0;
  if (!variant || !policyKey || deviceWorld.lostPrices.has(`${sku}|${policyKey}`)) return { cents: outright };
  const term = Number(policyKey.split('-').pop());
  const cents = policyKey.includes('lease') ? variant.prices.lease[24]?.centAmount : variant.prices.installments[term as 12 | 24 | 36]?.centAmount;
  return cents === undefined ? { cents: outright } : { cents, policyId: POLICY_IDS[policyKey as keyof typeof POLICY_IDS] };
}

function apply(cart: FakeCart, version: number, actions: { action: string; [key: string]: unknown }[]): FakeCart {
  if (version !== cart.version) throw { statusCode: 409 };
  deviceWorld.updates.push({ version, actions });
  for (const action of actions) {
    if (action.action === 'addLineItem') {
      const sku = action.sku as string;
      const quantity = (action.quantity as number | undefined) ?? 1;
      const custom = (action.custom as { fields: Record<string, unknown> } | undefined)?.fields ?? {};
      const recurrenceInfo = action.recurrenceInfo as { recurrencePolicy: { key?: string; id?: string }; priceSelectionMode: string } | undefined;
      const existing = cart.lineItems.find((line) => line.variant.sku === sku && JSON.stringify(line.custom.fields) === JSON.stringify(custom));
      if (existing) {
        existing.quantity += quantity;
        continue;
      }
      const policyKey = recurrenceInfo?.recurrencePolicy.key;
      const resolved = priceOf(sku, policyKey);
      deviceWorld.counter += 1;
      cart.lineItems.push({
        id: `line-${deviceWorld.counter}`,
        ...(action.addedAt ? { addedAt: action.addedAt as string } : {}),
        productKey: custom.offerKey as string,
        name: { 'en-US': sku },
        variant: { id: 1, sku },
        price: { value: money(resolved.cents), ...(resolved.policyId ? { recurrencePolicy: { typeId: 'recurrence-policy', id: resolved.policyId } } : {}) },
        quantity,
        totalPrice: money(resolved.cents * quantity),
        discountedPricePerQuantity: [],
        ...(recurrenceInfo && policyKey ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: POLICY_IDS[policyKey as keyof typeof POLICY_IDS] }, priceSelectionMode: recurrenceInfo.priceSelectionMode } } : {}),
        custom: { fields: custom },
      });
    } else if (action.action === 'removeLineItem') {
      cart.lineItems = cart.lineItems.filter((line) => line.id !== action.lineItemId);
    } else if (action.action === 'setLineItemCustomField') {
      const line = cart.lineItems.find((candidate) => candidate.id === action.lineItemId);
      if (line) line.custom.fields[action.name as string] = action.value;
    } else if (action.action === 'changeLineItemQuantity') {
      const line = cart.lineItems.find((candidate) => candidate.id === action.lineItemId);
      if (line) line.quantity = action.quantity as number;
    }
  }
  cart.version += 1;
  for (const line of cart.lineItems) line.totalPrice = money(line.price.value.centAmount * line.quantity);
  cart.totalPrice = money(cart.lineItems.reduce((sum, line) => sum + line.totalPrice.centAmount, 0));
  return cart;
}

const current = (): FakeCart => {
  if (!deviceWorld.cart) throw { statusCode: 404 };
  return deviceWorld.cart;
};

export function makeDeviceApiRoot() {
  return {
    carts: () => ({
      get: () => ({ execute: async () => ({ body: { results: deviceWorld.cart ? [structuredClone(deviceWorld.cart)] : [] } }) }),
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          deviceWorld.created += 1;
          deviceWorld.cart = { ...(ctCart({ id: 'cart-new', version: 1 }) as unknown as FakeCart), ...body, id: 'cart-new', version: 1, cartState: 'Active', lineItems: [], customLineItems: [], totalPrice: money(0) } as FakeCart;
          return { body: structuredClone(deviceWorld.cart) };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            if (!deviceWorld.cart || deviceWorld.cart.id !== ID) throw { statusCode: 404 };
            return { body: structuredClone(deviceWorld.cart) };
          },
        }),
        post: ({ body }: { body: { version: number; actions: { action: string }[] } }) => ({ execute: async () => ({ body: structuredClone(apply(current(), body.version, body.actions)) }) }),
        delete: () => ({
          execute: async () => {
            deviceWorld.cart = undefined;
            return { body: {} };
          },
        }),
      }),
    }),
    inventory: () => ({
      get: ({ queryArgs }: { queryArgs: { where: string } }) => ({
        execute: async () => {
          const skus = [...queryArgs.where.matchAll(/"([^"]+)"/g)].map((match) => match[1] as string);
          return { body: { results: skus.filter((sku) => sku in deviceWorld.inventory).map((sku) => ({ sku, availableQuantity: deviceWorld.inventory[sku] })) } };
        },
      }),
    }),
    cartDiscounts: () => ({ get: () => ({ execute: async () => ({ body: { results: [] } }) }) }),
    recurrencePolicies: () => ({
      get: () => ({ execute: async () => ({ body: { results: Object.entries(POLICY_IDS).map(([key, id]) => ({ id, key, version: 1 })) } }) }),
      withKey: () => ({ get: () => ({ execute: async () => ({ body: { id: 'pol-monthly', key: 'malva-monthly', version: 1 } }) }) }),
    }),
  };
}

export { policyKeyOfId };
