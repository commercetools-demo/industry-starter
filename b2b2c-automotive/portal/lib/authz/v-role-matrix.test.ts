/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Role matrix of workstream V (customers, subscriptions, returns, reviews). Table driven from the permission table and from the route
// files themselves: every write names an Admin-only action, reads name a view action, and a Buyer sees only the pages R allows.
// Deviation from the V plan, recorded in plans/notes/questions-VWXYZ.md (Q-V11): R's table lets a Buyer VIEW Returns and Reviews
// (`returns.view`, `reviews.view`), so those two lists are readable by a Buyer; every write is Admin only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { visibleItems } from '@/lib/portal/nav';
import { ACTION_ROLES, can, type PortalAction } from './permissions';

const root = path.resolve(import.meta.dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const MATRIX: Record<string, { admin: boolean; buyer: boolean }> = {
  'customers.view': { admin: true, buyer: false },
  'customers.manage': { admin: true, buyer: false },
  'customer-session.start': { admin: true, buyer: false },
  'subscriptions.view': { admin: true, buyer: false },
  'subscriptions.manage': { admin: true, buyer: false },
  'returns.view': { admin: true, buyer: true },
  'returns.process': { admin: true, buyer: false },
  'reviews.view': { admin: true, buyer: true },
  'reviews.moderate': { admin: true, buyer: false },
};
const WRITE_ACTIONS = ['customers.manage', 'customer-session.start', 'subscriptions.manage', 'returns.process', 'reviews.moderate'];
const READ_ACTIONS = ['customers.view', 'subscriptions.view', 'returns.view', 'reviews.view'];
const V_API = ['customers', 'subscriptions', 'returns', 'reviews', 'orders'];

const actionsIn = (source: string): string[] => [...source.matchAll(/(?:authorizeSeller\([^,]+,|authorizedBody\([^,]+,[^,]+,)\s*'([a-z.-]+)'/g)].map((m) => m[1]);

describe('V role matrix', () => {
  it.each(Object.entries(MATRIX))('%s: Admin and Buyer as in the table', (action, expected) => {
    expect(can({ roles: ['admin'], ctPermissions: [] }, action as PortalAction)).toBe(expected.admin);
    expect(can({ roles: ['buyer'], ctPermissions: [] }, action as PortalAction)).toBe(expected.buyer);
    expect(ACTION_ROLES[action as PortalAction]).toBeDefined();
  });

  it('the navigation shows Customers and Subscriptions to an Admin only; Returns and Reviews to both roles', () => {
    const admin = visibleItems(['admin']).map((i) => i.href);
    const buyer = visibleItems(['buyer']).map((i) => i.href);
    for (const page of ['/customers', '/subscriptions', '/returns', '/reviews']) expect(admin).toContain(page);
    expect(buyer).not.toContain('/customers');
    expect(buyer).not.toContain('/subscriptions');
    expect(buyer).toEqual(expect.arrayContaining(['/returns', '/reviews']));
  });

  it('every V route file names only V actions; every handler that writes names an Admin-only one', () => {
    const files = V_API.flatMap((d) => walk(path.join(root, 'app', 'api', 'seller', d))).filter((f) => /[\\/]route\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(17);
    const shared = actionsIn(readFileSync(path.join(root, 'lib', 'portal', 'v-route.ts'), 'utf8'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const used = [...actionsIn(source), ...(source.includes('subscriptionActionRoute') ? shared : [])];
      const rel = path.relative(root, file);
      expect(used.length, rel).toBeGreaterThan(0);
      for (const action of used) expect(Object.keys(MATRIX), `${rel} uses ${action}`).toContain(action);
      const writes = /export const POST/.test(source);
      if (writes) expect(used.some((a) => WRITE_ACTIONS.includes(a)), `${rel} POST needs an Admin-only action`).toBe(true);
      if (writes && !/export const GET/.test(source)) for (const action of used) expect(WRITE_ACTIONS, `${rel} POST uses ${action}`).toContain(action);
      if (!writes) for (const action of used) expect(READ_ACTIONS, `${rel} GET uses ${action}`).toContain(action);
    }
  });

  it('every V route file has its cross-store test', () => {
    const all = V_API.flatMap((d) => walk(path.join(root, 'app', 'api', 'seller', d)));
    const names = new Set(all);
    for (const file of all.filter((f) => /[\\/]route\.ts$/.test(f))) expect(names.has(file.replace(/route\.ts$/, 'route.cross-store.test.ts')), file).toBe(true);
  });
});
