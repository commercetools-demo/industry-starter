// @vitest-environment node
import { vi } from 'vitest';
import { forbiddenRoot, refusalSuite } from '@/test/seller';
import type { LogicalRole, Session } from '@/lib/types';

let session: Session = {};
let roles: LogicalRole[] = ['admin'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: forbiddenRoot() }));
vi.mock('@/lib/contentools/jwt', () => ({ getValidContentoolsJwt: async () => { throw new Error('the Contentools JWT must not be read'); } }));

import { POST } from './route';

const upload = (storeKey: string | null) => {
  const form = new FormData();
  if (storeKey) form.set('storeKey', storeKey);
  form.set('file', new Blob([new Uint8Array(64)], { type: 'image/png' }), 'favicon.png');
  return new Request('http://localhost:3000/api/seller/store/favicon', { method: 'POST', body: form });
};

refusalSuite({ handler: POST, build: upload, setSession: (s) => (session = s), setRoles: (r) => (roles = r) });
