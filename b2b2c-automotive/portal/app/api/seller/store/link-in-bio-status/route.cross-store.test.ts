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
const upstream = vi.fn(async () => new Response('{}', { status: 200 }));
vi.stubGlobal('fetch', upstream);

import { GET } from './route';

refusalSuite({
  handler: async (request) => {
    upstream.mockClear();
    const response = await GET(request);
    if (response.status !== 200) expect(upstream).not.toHaveBeenCalled();
    return response;
  },
  build: (key) => makeRequest(`/api/seller/store/link-in-bio-status${key ? `?storeKey=${key}` : ''}`),
  setSession: (s) => (session = s),
  setRoles: (r) => (roles = r),
});
