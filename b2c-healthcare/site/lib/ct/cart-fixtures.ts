import 'server-only';
import { checkLines } from '@/lib/ct/cart-validation';
import { fixtureMedicineBySku } from '@/lib/ct/doctors-fixtures';
import type { Patient } from '@/lib/ct/patient';
import type { RxContext, SelectedLine } from '@/lib/ct/prescriptions';
import { getFundingResolver, normalizeScheme } from '@/lib/funding/resolver';
import type { Cart, CartLine, Money } from '@/lib/types';

/**
 * Development-only cart (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): one in-memory cart per fixture customer, so
 * the cart page can be checked in a browser without commercetools. It imitates the platform answer (including its
 * arithmetic, here only because there is no platform); the production path never computes a total.
 */

const carts = new Map<string, CartLine[]>();
/** List unit price (cents) of each fixture line, so cost-share can be re-resolved from the list price. */
const listCents = new Map<string, number>();
const unresolvedFor = new Set<string>();
let counter = 0;
const FREE: Money = { centAmount: 0, currencyCode: 'USD', fractionDigits: 2 };

/**
 * Cost-share for the fixture cart (workstream U): the same resolver as production, applied to the in-memory lines. A
 * failing resolver leaves the cart `unresolved` (no cover figures; checkout disabled), never the list price.
 */
export async function applyFixtureFunding(customerId: string, patient?: Pick<Patient, 'patientRef' | 'fundingScheme'>): Promise<void> {
  const lines = carts.get(customerId);
  if (!lines || !patient || !normalizeScheme(patient.fundingScheme)) return;
  try {
    const resolution = await getFundingResolver().resolve(
      { patientRef: patient.patientRef, fundingScheme: patient.fundingScheme ?? null },
      lines.map((l) => ({ sku: l.sku, unit: listCents.get(l.id) ?? l.unitPrice.centAmount, quantity: 1 })),
    );
    unresolvedFor.delete(customerId);
    lines.forEach((l, i) => {
      const row = resolution.perLine[i];
      const list = listCents.get(l.id) ?? l.unitPrice.centAmount;
      const owed: Money = { centAmount: row.owed, currencyCode: 'USD', fractionDigits: 2 };
      l.unitPrice = owed;
      l.totalPrice = owed;
      l.youOwe = owed;
      l.coveredAmount = { centAmount: list - row.owed, currencyCode: 'USD', fractionDigits: 2 };
      l.cover = row.status;
    });
  } catch {
    unresolvedFor.add(customerId);
  }
}

function view(customerId: string, lines: CartLine[], problems = new Map<string, Cart['lines'][number]['unavailable']>()): Cart {
  const unresolved = unresolvedFor.has(customerId);
  const withProblems = lines.map((l) => {
    const unavailable = problems.get(l.id);
    const base = unresolved ? { ...l, cover: 'unresolved' as const, coveredAmount: undefined, youOwe: undefined } : l;
    return unavailable ? { ...base, unavailable } : base;
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
    ...(unresolved
      ? { unresolved: true }
      : lines.some((l) => l.coveredAmount)
        ? { youOwe: money, planCovers: { centAmount: lines.reduce((sum, l) => sum + (l.coveredAmount?.centAmount ?? 0), 0), currencyCode: 'USD', fractionDigits: 2 } }
        : {}),
  };
}

export async function addRxLines(customerId: string, rxNumber: string, accepted: SelectedLine[], patient?: Patient): Promise<{ cart: Cart }> {
  const refs = new Set(accepted.map((a) => a.lineRef));
  const lines = (carts.get(customerId) ?? []).filter((l) => !(l.rxNumber === rxNumber && refs.has(l.rxLineRef)));
  for (const a of accepted) {
    const med = fixtureMedicineBySku(a.sku);
    const price = a.price ?? med?.price ?? FREE;
    counter += 1;
    listCents.set(`fixture-line-${counter}`, price.centAmount);
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
      ...(a.hsaEligible ? { eligibleForRestricted: true } : {}),
    });
  }
  carts.set(customerId, lines);
  await applyFixtureFunding(customerId, patient);
  return { cart: view(customerId, lines) };
}

export async function removeLine(customerId: string, lineId: string, patient?: Patient): Promise<{ cart: Cart } | null> {
  const lines = carts.get(customerId);
  if (!lines) return null;
  const next = lines.filter((l) => l.id !== lineId);
  carts.set(customerId, next);
  await applyFixtureFunding(customerId, patient);
  return { cart: view(customerId, next) };
}

export async function getCart(customerId: string): Promise<Cart | null> {
  const lines = carts.get(customerId);
  return lines ? view(customerId, lines) : null;
}

export async function getCartValidated(patient: Patient, customerId: string, ctx: RxContext): Promise<Cart | null> {
  const lines = carts.get(customerId);
  if (!lines) return null;
  await applyFixtureFunding(customerId, patient);
  const problems = await checkLines(patient, lines.map((l) => ({ id: l.id, rx: { rxNumber: l.rxNumber, rxLineRef: l.rxLineRef } })), ctx);
  const cart = view(customerId, lines, problems);
  const { fixtureTenderView } = await import('@/lib/ct/funding-fixtures');
  return lines.length > 0 ? { ...cart, tender: await fixtureTenderView(cart, customerId, patient.patientRef, ctx.now) } : cart;
}

/** After an order is placed (workstream Q): the fixture cart is emptied. */
export function clearCart(customerId: string): void {
  carts.delete(customerId);
  unresolvedFor.delete(customerId);
}
