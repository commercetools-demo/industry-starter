import 'server-only';
// Test helper (workstream S): the mocks and the shared scenarios of the dashboard Route Handler tests. Never used by app code.
//   vi.mock('@/lib/portal/seam', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).seamMock);
//   vi.mock('@/lib/ct/associate', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).associateMock);
//   vi.mock('@/lib/ct/seller/dashboard/ports', async () => (await import('@/lib/ct/seller/dashboard/route-harness')).portsMock);
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogicalRole } from '@/lib/authz/permissions';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';
import type { DashboardPorts } from './ports';

const port = <T>(value: T) =>
  vi.fn(async (storeKey: string) => {
    void storeKey;
    return value;
  });
const makePorts = () => ({
  openOrders: port(3),
  recentOrders: port([]),
  openReturns: port(2),
  returnsToHandle: port([]),
  activeSubscriptions: port(1),
  renewals: port([]),
  unansweredReviews: port(4),
  lowStock: port([]),
  headsUp: port(null),
  storePerformance: port({ sales: { centAmount: 1, currencyCode: 'EUR', fractionDigits: 2 } }),
  storeHeader: port({ name: {}, region: 'DE', currency: 'EUR' }),
});

export const harness = {
  session: {} as Session,
  roles: ['admin'] as LogicalRole[],
  ports: makePorts(),
  associateCalls: 0,
  reset(who: 'adminA' | 'buyerA' | 'none' = 'adminA') {
    this.session = who === 'none' ? {} : sessionFor(who);
    this.roles = who === 'buyerA' ? ['buyer'] : ['admin'];
    this.ports = makePorts();
    this.associateCalls = 0;
  },
};

export const seamMock = {
  readSession: async () => harness.session,
  writeSession: async (fn: (s: Session) => Session) => fn(harness.session),
  clearSession: async () => undefined,
  devFixturesEnabled: () => false,
  getPorts: () => ({ loadViewer: async () => null }),
};
export const associateMock = {
  getAssociateRoles: async () => {
    harness.associateCalls += 1;
    return { roleKeys: [], roles: harness.roles, ctPermissions: [] };
  },
};
export const portsMock = { getDashboardPorts: () => harness.ports as unknown as DashboardPorts };

const callCount = () => Object.values(harness.ports).reduce((n, p) => n + p.mock.calls.length, 0);
type Handler = (request: Request) => Promise<Response>;
const get = (handler: Handler, query = '') => handler(makeRequest(`/api/seller/dashboard/x${query}`));

/** Scenarios of `route.test.ts` for one dashboard route. */
export function describeDashboardRoute(name: string, handler: Handler, widget: string, ports: Array<keyof typeof harness.ports>, opts: { buyer: 200 | 403 } = { buyer: 200 }) {
  describe(`GET /api/seller/dashboard/${name}`, () => {
    beforeEach(() => harness.reset('adminA'));
    afterEach(() => vi.unstubAllEnvs());

    it('401 without session', async () => {
      harness.reset('none');
      const res = await get(handler);
      expect(res.status).toBe(401);
      expect(callCount()).toBe(0);
    });

    it('200 with no-store, reading only the session store', async () => {
      const res = await get(handler);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      for (const p of ports) expect(harness.ports[p]).toHaveBeenCalledWith('store-a');
    });

    it('502 body has no stack or upstream message when commercetools fails', async () => {
      for (const p of ports) harness.ports[p].mockRejectedValue(Object.assign(new Error('secret-upstream-message at /srv/app.js:1'), { statusCode: 500 }));
      const res = await get(handler);
      const text = await res.text();
      // A route may degrade per value (the KPIs answer 200 with null); every other route answers 502.
      if (res.status === 502) expect(text).toBe('{"error":"unavailable"}');
      expect(text).not.toContain('secret-upstream-message');
      expect(text).not.toContain('app.js');
    });

    it(`role matrix: Buyer ${opts.buyer}, Admin 200`, async () => {
      expect((await get(handler)).status).toBe(200);
      harness.reset('buyerA');
      expect((await get(handler)).status).toBe(opts.buyer);
      if (opts.buyer === 403) expect(callCount()).toBe(0);
    });

    it(`simulate: ${widget}-down gives 502, ${widget}-empty gives the empty state, ignored in production`, async () => {
      const down = await get(handler, `?simulate=${widget}-down`);
      expect(down.status).toBe(502);
      expect(callCount()).toBe(0);
      const empty = await get(handler, `?simulate=${widget}-empty`);
      expect(empty.status).toBe(200);
      expect(callCount()).toBe(0);
      vi.stubEnv('NODE_ENV', 'production');
      const prod = await get(handler, `?simulate=${widget}-down`);
      expect(prod.status).toBe(200);
      expect(callCount()).toBeGreaterThan(0);
    });
  });
}

/** Scenarios of `route.cross-store.test.ts` for one dashboard route. */
export function describeCrossStore(name: string, handler: Handler, ports: Array<keyof typeof harness.ports>) {
  describe(`GET /api/seller/dashboard/${name} (store scope)`, () => {
    beforeEach(() => harness.reset('adminA'));

    it('forged storeKey in query or header is ignored; only the session store is read', async () => {
      const res = await handler(makeRequest('/api/seller/dashboard/x?storeKey=store-b&store=store-b', { headers: { 'x-store-key': 'store-b' } }));
      expect(res.status).toBe(200);
      for (const p of ports) {
        expect(harness.ports[p]).toHaveBeenCalledWith('store-a');
        expect(harness.ports[p]).not.toHaveBeenCalledWith('store-b');
      }
    });

    it('a session without store, or a reduced pending session, gets 403 or 400 with zero commercetools calls', async () => {
      harness.session = { customerId: 'cust-admin-a', businessUnitKey: 'bu-a' };
      expect([400, 403]).toContain((await get(handler)).status);
      harness.session = { customerId: 'cust-admin-a', pending: true };
      expect([400, 403]).toContain((await get(handler)).status);
      expect(callCount()).toBe(0);
    });

    it('an associate without a role in the store gets 403 with zero commercetools calls', async () => {
      harness.roles = [];
      const res = await get(handler);
      expect(res.status).toBe(403);
      expect(callCount()).toBe(0);
    });

    it('the store check and the role check run before any read (authorizeStore asked once)', async () => {
      await get(handler);
      expect(harness.associateCalls).toBe(1);
    });
  });
}
