// @vitest-environment node
import { GET } from './route';

const execute = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({ get: () => ({ execute }) }),
  getProjectKey: () => 'spec-test-b2c',
}));

describe('GET /api/health', () => {
  it('Valid credentials: returns ok and the project key', async () => {
    execute.mockResolvedValue({});
    const res = await GET();
    expect(await res.json()).toEqual({ ok: true, projectKey: 'spec-test-b2c' });
  });

  it('returns ok:false with the error and status 500 on failure', async () => {
    execute.mockRejectedValue(new Error('invalid_client'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'invalid_client' });
  });

  it('is 404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET()).status).toBe(404);
    vi.unstubAllEnvs();
  });
});
