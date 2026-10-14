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

import { GET, PUT } from './route';

const NAME = { 'de-DE': 'Test Shop', 'en-US': 'Test Shop' };
const opts = { setSession: (s: Session) => (session = s), setRoles: (r: LogicalRole[]) => (roles = r) };

refusalSuite({ ...opts, handler: GET, build: (key) => makeRequest(`/api/seller/store/settings${key ? `?storeKey=${key}` : ''}`) });
refusalSuite({ ...opts, handler: PUT, build: (key) => makeRequest('/api/seller/store/settings', { method: 'PUT', json: { ...(key ? { storeKey: key } : {}), name: NAME, location: {} } }) });
