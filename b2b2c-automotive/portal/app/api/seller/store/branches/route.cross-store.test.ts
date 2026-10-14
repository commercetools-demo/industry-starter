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

import { GET, POST } from './route';

const opts = { setSession: (s: Session) => (session = s), setRoles: (r: LogicalRole[]) => (roles = r) };
const branch = {
  slug: 'test-branch',
  name: { 'de-DE': 'Test Branch', 'en-US': 'Test Branch' },
  address: { streetName: 'Hafenallee', postalCode: '21079', city: 'Hamburg', country: 'DE' },
  openingHours: { mon: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
};

refusalSuite({ ...opts, handler: GET, build: (key) => makeRequest(`/api/seller/store/branches${key ? `?storeKey=${key}` : ''}`) });
refusalSuite({ ...opts, handler: POST, build: (key) => makeRequest('/api/seller/store/branches', { method: 'POST', json: { ...(key ? { storeKey: key } : {}), ...branch } }) });
