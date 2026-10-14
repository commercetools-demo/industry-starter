/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { vi } from 'vitest';
import { forbiddenRoot, refusalSuite } from '@/test/seller';
import { makeRequest } from '@/test/request';
import type { LogicalRole, Session } from '@/lib/types';

let session: Session = {};
let roles: LogicalRole[] = ['admin'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: forbiddenRoot() }));

import { GET } from './route';

const context = { params: Promise.resolve({ key: 'mau-br-north-hamburg' }) };

refusalSuite({
  handler: (r) => GET(r, context),
  build: (key) => makeRequest(`/api/seller/store/branches/mau-br-north-hamburg/stock${key ? `?storeKey=${key}` : ''}`),
  setSession: (s) => (session = s),
  setRoles: (r) => (roles = r),
});
