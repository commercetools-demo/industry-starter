// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Subscriptions (recurring orders) of the store (S-02). No in-store endpoint exists for recurring orders, so the project-level
// endpoint is filtered by `store(key=...)`; the key comes from the session only.
import 'server-only';
import type { RecurringOrder } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';
import { withTimeout } from './timeout';
import type { RenewalRow } from '@/lib/dashboard/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const where = (storeKey: string) => `store(key="${storeKey.replace(/["\\]/g, '')}") and recurringOrderState="Active"`;

/** Active recurring orders of the store (paused, cancelled and expired ones are not counted). */
export function countActiveSubscriptions(storeKey: string): Promise<number> {
  return withTimeout(
    adminRoot
      .recurringOrders()
      .get({ queryArgs: { where: where(storeKey), limit: 1, withTotal: true } })
      .execute()
      .then(({ body }) => body.total ?? 0),
  );
}

/** Active subscriptions whose next order falls within `days` from `now`, soonest first. */
export function listRenewals(storeKey: string, days = 7, limit = 5, now: Date = new Date()): Promise<RenewalRow[]> {
  const until = now.getTime() + days * DAY_MS;
  return withTimeout(
    adminRoot
      .recurringOrders()
      .get({ queryArgs: { where: where(storeKey), expand: ['cart'], sort: 'nextOrderAt asc', limit: 50, withTotal: false } })
      .execute()
      .then(({ body }) =>
        body.results
          .filter((r: RecurringOrder) => r.nextOrderAt !== undefined && Date.parse(r.nextOrderAt) <= until)
          .slice(0, limit)
          .map((r: RecurringOrder) => {
            const lines = r.cart.obj?.lineItems ?? [];
            return { id: r.id, nextOrderAt: r.nextOrderAt as string, name: lines[0]?.name ?? {}, itemCount: lines.length };
          }),
      ),
  );
}
