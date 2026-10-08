import 'server-only';
import { isBeforeSameDayCutoff, SAME_DAY_METHOD_KEY, STANDARD_METHOD_KEY } from '@/lib/checkout/config';
import type { CheckoutContext, MethodOutcome } from '@/lib/ct/checkout';
import * as cartFixtures from '@/lib/ct/cart-fixtures';
import type { AddressInput, CheckoutState, DeliveryOption, Money } from '@/lib/types';

/**
 * Development-only checkout (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): the address and delivery method live in
 * memory next to the fixture cart, so the checkout page can be checked in a browser without commercetools. It
 * imitates the platform's answer, including the arithmetic, only because there is no platform; the production path
 * never computes a total. Never loaded in production.
 */

interface Held {
  address: AddressInput | null;
  methodKey: string;
}
const held = new Map<string, Held>();
const zero = (): Money => ({ centAmount: 0, currencyCode: 'USD', fractionDigits: 2 });
const SAME_DAY_STATES = ['NY', 'TX', 'IL'];
const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

const holdFor = (customerId: string): Held => {
  let h = held.get(customerId);
  if (!h) {
    h = { address: null, methodKey: STANDARD_METHOD_KEY };
    held.set(customerId, h);
  }
  return h;
};

function optionsFor(h: Held, now: Date): DeliveryOption[] {
  const options: DeliveryOption[] = [{ key: STANDARD_METHOD_KEY, name: 'Standard delivery', price: zero() }];
  if (h.address && SAME_DAY_STATES.includes(h.address.state) && isBeforeSameDayCutoff(now)) options.push({ key: SAME_DAY_METHOD_KEY, name: 'Same-day delivery', price: usd(500) });
  return options;
}

async function state(ctx: CheckoutContext): Promise<CheckoutState | null> {
  const cart = await cartFixtures.getCartValidated(ctx.patient, ctx.customerId, ctx.rx);
  if (!cart) return null;
  const h = holdFor(ctx.customerId);
  const options = optionsFor(h, ctx.now);
  if (!options.some((o) => o.key === h.methodKey)) h.methodKey = STANDARD_METHOD_KEY;
  const chosen = options.find((o) => o.key === h.methodKey) ?? options[0];
  const subtotal = cart.subtotal?.centAmount ?? 0;
  return {
    cart: {
      ...cart,
      shipping: { name: chosen.name, price: chosen.price },
      total: usd(subtotal + chosen.price.centAmount),
      shippingAddress: h.address,
      shippingMethodKey: chosen.key,
      tax: zero(),
    },
    options,
    deliverable: true,
    paymentMode: 'demo',
  };
}

export const readCheckout = (ctx: CheckoutContext): Promise<CheckoutState | null> => state(ctx);

export async function setAddress(ctx: CheckoutContext, input: AddressInput): Promise<CheckoutState | null> {
  holdFor(ctx.customerId).address = input;
  return state(ctx);
}

export async function setShippingMethod(ctx: CheckoutContext, key: string): Promise<MethodOutcome | null> {
  const before = await state(ctx);
  if (!before) return null;
  if (!before.options.some((o) => o.key === key)) return { state: before, accepted: false };
  holdFor(ctx.customerId).methodKey = key;
  const next = await state(ctx);
  return next ? { state: next, accepted: true } : null;
}
