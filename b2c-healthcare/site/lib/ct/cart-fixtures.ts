import 'server-only';
import { checkLines } from '@/lib/ct/cart-validation';
import { fixtureMedicineBySku } from '@/lib/ct/doctors-fixtures';
import type { Patient } from '@/lib/ct/patient';
import type { RxContext, SelectedLine } from '@/lib/ct/prescriptions';
import type { Cart, CartLine, Money } from '@/lib/types';

/**
 * Development-only cart (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): one in-memory cart per fixture customer, so
 * the cart page can be checked in a browser without commercetools. It imitates the platform answer (including its
 * arithmetic, here only because there is no platform); the production path never computes a total.
 */

const carts = new Map<string, CartLine[]>();
let counter = 0;
const FREE: Money = { centAmount: 0, currencyCode: 'USD', fractionDigits: 2 };

function view(customerId: string, lines: CartLine[], problems = new Map<string, Cart['lines'][number]['unavailable']>()): Cart {
  const withProblems = lines.map((l) => {
    const unavailable = problems.get(l.id);
    return unavailable ? { ...l, unavailable } : l;
  });
  const cents = lines.reduce((sum, l) => sum + l.totalPrice.centAmount, 0);
  const money: Money = { centAmount: cents, currencyCode: 'USD', fractionDigits: 2 };
  return {
    id: `fixture-cart-${customerId}`,
    version: 1,
    itemCount: lines.length,
    lineCount: lines.length,
    currencyCode: 'USD',
    lines: withProblems,
    subtotal: lines.length ? money : null,
    shipping: { name: 'Standard delivery', price: FREE },
    total: money,
    unavailableCount: problems.size,
  };
}

export async function addRxLines(customerId: string, rxNumber: string, accepted: SelectedLine[]): Promise<{ cart: Cart }> {
  const refs = new Set(accepted.map((a) => a.lineRef));
  const lines = (carts.get(customerId) ?? []).filter((l) => !(l.rxNumber === rxNumber && refs.has(l.rxLineRef)));
  for (const a of accepted) {
    const med = fixtureMedicineBySku(a.sku);
    const price = a.price ?? med?.price ?? FREE;
    counter += 1;
    lines.push({
      id: `fixture-line-${counter}`,
      sku: a.sku,
      name: { 'en-US': med?.name ?? a.sku },
      rxNumber,
      rxLineRef: a.lineRef,
      prescribedQty: a.qty,
      unitPrice: price,
      totalPrice: price,
      priceUpdated: false,
    });
  }
  carts.set(customerId, lines);
  return { cart: view(customerId, lines) };
}

export async function removeLine(customerId: string, lineId: string): Promise<{ cart: Cart } | null> {
  const lines = carts.get(customerId);
  if (!lines) return null;
  const next = lines.filter((l) => l.id !== lineId);
  carts.set(customerId, next);
  return { cart: view(customerId, next) };
}

export async function getCart(customerId: string): Promise<Cart | null> {
  const lines = carts.get(customerId);
  return lines ? view(customerId, lines) : null;
}

export async function getCartValidated(patient: Patient, customerId: string, ctx: RxContext): Promise<Cart | null> {
  const lines = carts.get(customerId);
  if (!lines) return null;
  const problems = await checkLines(patient, lines.map((l) => ({ id: l.id, rx: { rxNumber: l.rxNumber, rxLineRef: l.rxLineRef } })), ctx);
  return view(customerId, lines, problems);
}
