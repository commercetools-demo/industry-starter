// @vitest-environment node
import { GET } from './route.dev';

const execute = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({ get: () => ({ execute }) }),
  getApiUrl: () => 'https://api.us-central1.gcp.commercetools.com',
}));

describe('GET /api/health', () => {
  it('Connection check available in development only: returns the project key when the API answers', async () => {
    execute.mockResolvedValue({ body: { key: 'spec-test-b2c-telecom', name: 'x' } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, projectKey: 'spec-test-b2c-telecom', region: 'us-central1.gcp' });
  });

  it('answers 500 with the error name only', async () => {
    execute.mockRejectedValue(new Error('invalid_client for id abc123 secret xyz'));
    const res = await GET();
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'Error' });
    expect(text).not.toContain('abc123');
  });
});
