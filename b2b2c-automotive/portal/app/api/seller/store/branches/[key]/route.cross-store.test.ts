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

import { DELETE, PUT } from './route';

const opts = { setSession: (s: Session) => (session = s), setRoles: (r: LogicalRole[]) => (roles = r) };
const context = { params: Promise.resolve({ key: 'mau-br-north-hamburg' }) };
const branch = {
  name: { 'de-DE': 'Test Branch', 'en-US': 'Test Branch' },
  address: { streetName: 'Hafenallee', postalCode: '21079', city: 'Hamburg', country: 'DE' },
  openingHours: { mon: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
};

refusalSuite({ ...opts, handler: (r) => PUT(r, context), build: (key) => makeRequest('/api/seller/store/branches/mau-br-north-hamburg', { method: 'PUT', json: { ...(key ? { storeKey: key } : {}), ...branch } }) });
refusalSuite({ ...opts, handler: (r) => DELETE(r, context), build: (key) => makeRequest(`/api/seller/store/branches/mau-br-north-hamburg${key ? `?storeKey=${key}` : ''}`, { method: 'DELETE' }) });
