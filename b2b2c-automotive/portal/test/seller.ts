// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shared refusal suite of the seller endpoints of workstream U. A route's `route.cross-store.test.ts` declares its three mocks
// (seam session, associate roles, a throwing admin client) and calls `refusalSuite`: another store is refused, a Buyer is refused,
// an anonymous caller gets 401, a missing store key 400, and commercetools is never called by any of them.
import { beforeEach, describe, expect, it } from 'vitest';
// (expect is used by the cases below)
import { sessionFor } from '@/lib/authz/test-helpers';
import type { LogicalRole, Session } from '@/lib/types';

export const SESSION_STORE = 'store-a';
export const OTHER_STORE = 'store-b';

/** `vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: forbiddenRoot() }))`: any use of the admin client throws. */
export function forbiddenRoot(): object {
  return new Proxy({}, {
    get() {
      throw new Error('commercetools must not be called');
    },
  });
}

export interface RefusalOptions {
  handler: (request: Request) => Promise<Response>;
  /** A request for the given store key (the key of the session's store, or another one). */
  build: (storeKey: string | null) => Request;
  setSession: (session: Session) => void;
  setRoles: (roles: LogicalRole[]) => void;
  /** Skip the Buyer case for routes every role may call. */
  buyerAllowed?: boolean;
}

export function refusalSuite({ handler, build, setSession, setRoles, buyerAllowed = false }: RefusalOptions): void {
  describe('refusals (no commercetools call)', () => {
    beforeEach(() => {
      setSession(sessionFor('adminA'));
      setRoles(['admin']);
    });

    it('a request that names another store is 403 or 404', async () => {
      const response = await handler(build(OTHER_STORE));
      expect([403, 404]).toContain(response.status);
    });

    it('a missing store key is 400', async () => {
      expect((await handler(build(null))).status).toBe(400);
    });

    it('an anonymous caller is 401', async () => {
      setSession({});
      expect((await handler(build(SESSION_STORE))).status).toBe(401);
    });

    if (!buyerAllowed) {
      it('a Buyer is 403 for the session store too', async () => {
        setSession(sessionFor('buyerA'));
        setRoles(['buyer']);
        expect((await handler(build(SESSION_STORE))).status).toBe(403);
      });
    }

    it('a pending session (no business unit) is 403', async () => {
      setSession({ customerId: 'c', pending: true });
      expect((await handler(build(SESSION_STORE))).status).toBe(403);
    });
  });
}
