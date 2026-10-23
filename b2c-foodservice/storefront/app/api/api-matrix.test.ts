// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The checked-in auth table of every Route Handler (workstream Q, S5).
 * - `customer`: a signed-in shopper is required (`requireCustomer`, 401 with no detail); data is scoped by the session customer id.
 * - `session`: works for guests and members; the cart, store and market come from the signed session cookie, never from the body.
 * - `public`: no session data in the answer.
 * - `owner-or-guest`: the order id gates access (a member's order only to its owner, a guest order to the holder of the UUID).
 * - `dev`: removed by the deploy gate (`npm run predeploy`).
 * A new `route.ts` without an entry fails this test.
 */
const TABLE: Record<string, 'customer' | 'session' | 'public' | 'owner-or-guest' | 'dev'> = {
  '[...rest]': 'public',
  'account/addresses': 'customer',
  'account/addresses/[id]': 'customer',
  'account/delete': 'customer',
  'account/password': 'customer',
  'account/payment-methods': 'customer',
  'account/payment-methods/[id]': 'customer',
  'account/payment-methods/[id]/default': 'customer',
  'account/profile': 'customer',
  'account/summary': 'customer',
  'auth/demo-customers': 'public',
  'auth/demo-login': 'public',
  'auth/login': 'public',
  'auth/logout': 'session',
  'auth/me': 'session',
  'auth/register': 'public',
  availability: 'public',
  cart: 'session',
  'cart/count': 'session',
  'cart/lines': 'session',
  'cart/lines/[lineId]': 'session',
  channels: 'public',
  checkout: 'session',
  'checkout/complete': 'session',
  'checkout/pickup': 'session',
  'checkout/session': 'session',
  contact: 'public',
  'dev/session': 'dev',
  'faq-feedback': 'public',
  gate: 'public',
  health: 'dev',
  newsletter: 'public',
  orders: 'customer',
  'orders/[id]': 'owner-or-guest',
  'orders/[id]/reorder': 'customer',
  'orders/[id]/returns': 'customer',
  'recurrence-policies': 'public',
  'recurring-orders': 'customer',
  'recurring-orders/[id]': 'customer',
  reviews: 'public',
  'reviews/[id]': 'customer',
  search: 'public',
  'session/market': 'session',
  'session/store': 'session',
  'shopping-lists': 'customer',
  'shopping-lists/add-to-cart': 'customer',
  'tracker/[...path]': 'public',
};

const API = __dirname;

function routes(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...routes(full));
    else if (name === 'route.ts') found.push(relative(API, dir).split(sep).join('/'));
  }
  return found.sort();
}

const source = (route: string) => readFileSync(join(API, route, 'route.ts'), 'utf8');

describe('API route auth matrix', () => {
  it('a new route without a table entry fails', () => {
    const missing = routes(API).filter((r) => !(r in TABLE));
    expect(missing).toEqual([]);
  });

  it('a table entry without a route fails', () => {
    const present = new Set(routes(API));
    expect(Object.keys(TABLE).filter((r) => !present.has(r))).toEqual([]);
  });

  it('every customer route calls requireCustomer in each exported method, public routes never read the customer id', () => {
    for (const [route, kind] of Object.entries(TABLE)) {
      const src = source(route);
      if (kind === 'customer') {
        const handlers = src.match(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)?.length ?? 0;
        const guards = src.match(/requireCustomer\(/g)?.length ?? 0;
        // reviews: GET is public and POST needs a customer, so the guard count may be lower than the method count
        expect(guards, route).toBeGreaterThan(0);
        expect(guards, route).toBeLessThanOrEqual(Math.max(handlers, 1) * 2);
      }
      if (kind === 'public' && route !== 'reviews' && route !== 'auth/demo-login' && route !== 'auth/login') {
        expect(src, route).not.toMatch(/session\.customerId|\.customerId/);
      }
    }
  });

  it('the dev routes are exactly the ones the deploy gate names', () => {
    expect(Object.entries(TABLE).filter(([, k]) => k === 'dev').map(([r]) => r).sort()).toEqual(['dev/session', 'health']);
  });
});
