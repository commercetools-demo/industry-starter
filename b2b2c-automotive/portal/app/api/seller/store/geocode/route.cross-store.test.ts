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
const geocode = vi.fn();
vi.mock('@/lib/geo/nominatim', () => ({ geocodeAddress: (a: string) => geocode(a) }));

import { POST } from './route';

refusalSuite({
  handler: async (request) => {
    geocode.mockClear();
    const response = await POST(request);
    if (response.status !== 200) expect(geocode).not.toHaveBeenCalled();
    return response;
  },
  build: (key) => makeRequest('/api/seller/store/geocode', { method: 'POST', json: { ...(key ? { storeKey: key } : {}), address: 'Hafenallee 12 Hamburg' } }),
  setSession: (s) => (session = s),
  setRoles: (r) => (roles = r),
});
