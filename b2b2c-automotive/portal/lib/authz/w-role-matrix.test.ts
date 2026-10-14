/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Role matrix of workstream W (section "Role matrix"): Marketing, E-mail, Bundles, Product import and Brand partnership are Admin
// only; a Buyer sees none of the pages and every one of W's seller routes asks for an Admin-only action. Table driven from the
// permission table and from the route files themselves, so a new W route with a weaker action fails here.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { visibleItems } from '@/lib/portal/nav';
import { ACTION_ROLES, can, rolesFor, type PortalAction } from './permissions';

const root = path.resolve(import.meta.dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const W_API = ['campaigns', 'email', 'bundles', 'local-products', 'import', 'partnership'];
const W_ACTIONS: PortalAction[] = ['marketing.manage', 'email.manage', 'bundles.manage', 'import.run', 'partnership.view'];
const W_PAGES = ['/marketing', '/email', '/bundles', '/import', '/partnership'];

describe('W role matrix', () => {
  it.each(W_ACTIONS)('%s is allowed for Admin and not for Buyer', (action) => {
    expect(rolesFor(action)).toEqual(['admin']);
    expect(can({ roles: ['admin'], ctPermissions: [] }, action)).toBe(true);
    expect(can({ roles: ['buyer'], ctPermissions: [] }, action)).toBe(false);
  });

  it('the navigation shows the five W pages to an Admin and none to a Buyer', () => {
    const admin = visibleItems(['admin']).map((i) => i.href);
    const buyer = visibleItems(['buyer']).map((i) => i.href);
    for (const page of W_PAGES) {
      expect(admin).toContain(page);
      expect(buyer).not.toContain(page);
    }
  });

  it('every W seller route file names only Admin-only actions of W', () => {
    const files = W_API.flatMap((d) => walk(path.join(root, 'app', 'api', 'seller', d))).filter((f) => /[\\/]route\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const used = [...source.matchAll(/(?:authorizeSeller\([^,]+,|authorizedBody\([^,]+,[^,]+,)\s*'([a-z.-]+)'/g)].map((m) => m[1]);
      expect(used.length, path.relative(root, file)).toBeGreaterThan(0);
      for (const action of used) {
        expect(W_ACTIONS, `${path.relative(root, file)} uses ${action}`).toContain(action);
        expect(ACTION_ROLES[action as PortalAction]).toEqual(['admin']);
      }
    }
  });

  it('every W route file has its cross-store test (check-routes enforces the same for all seller routes)', () => {
    const files = W_API.flatMap((d) => walk(path.join(root, 'app', 'api', 'seller', d))).filter((f) => /[\\/]route\.ts$/.test(f));
    const names = new Set(W_API.flatMap((d) => walk(path.join(root, 'app', 'api', 'seller', d))));
    for (const file of files) expect(names.has(file.replace(/route\.ts$/, 'route.cross-store.test.ts')), file).toBe(true);
  });
});
