import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeamMock } from '@/test/portal-mocks';
import { makeRequest } from '@/test/request';

let m = createSeamMock();
vi.mock('@/lib/portal/seam', () => ({
  readSession: () => m.seam.readSession(),
  writeSession: (fn: never) => m.seam.writeSession(fn),
  getPorts: () => m.seam.getPorts(),
}));

import { POST } from './route.dev';

const post = (json: unknown) => POST(makeRequest('/api/dev/act-as', { method: 'POST', json }));

beforeEach(() => {
  m = createSeamMock({ customerId: 'seller-1', businessUnitKey: 'bu', storeKey: 's1' });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/dev/act-as', () => {
  it('404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await post({ name: 'Test Driver' })).status).toBe(404);
    expect(m.state.writes).toBe(0);
  });

  it('sets actingAs in development', async () => {
    expect((await post({ name: 'Test Driver' })).status).toBe(200);
    expect(m.state.session.actingAs).toBe('Test Driver');
  });

  it('needs a session', async () => {
    m.state.session = {};
    expect((await post({ name: 'Test Driver' })).status).toBe(401);
  });
});
