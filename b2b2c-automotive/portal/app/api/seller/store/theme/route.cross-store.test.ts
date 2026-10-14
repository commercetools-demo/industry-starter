/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { expect, vi } from 'vitest';
import { forbiddenRoot, refusalSuite } from '@/test/seller';
import { makeRequest } from '@/test/request';
import type { LogicalRole, Session } from '@/lib/types';

let session: Session = {};
let roles: LogicalRole[] = ['admin'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: forbiddenRoot() }));
const getJwt = vi.fn(async () => 'jwt');
vi.mock('@/lib/contentools/jwt', () => ({ getValidContentoolsJwt: () => getJwt() }));
const upstream = vi.fn(async () => new Response(null, { status: 204 }));
vi.stubGlobal('fetch', upstream);

import { DELETE } from './route';

refusalSuite({
  handler: async (request) => {
    upstream.mockClear();
    getJwt.mockClear();
    const response = await DELETE(request);
    if (response.status !== 200) {
      expect(upstream).not.toHaveBeenCalled();
      expect(getJwt).not.toHaveBeenCalled();
    }
    return response;
  },
  build: (key) => makeRequest(`/api/seller/store/theme${key ? `?storeKey=${key}` : ''}`, { method: 'DELETE' }),
  setSession: (s) => (session = s),
  setRoles: (r) => (roles = r),
});
