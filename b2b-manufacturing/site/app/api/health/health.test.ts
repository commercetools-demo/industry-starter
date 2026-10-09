// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/ct/client', () => ({ apiRoot: { get: () => ({ execute: get }) } }));
const { GET } = await import('./route');
afterEach(() => vi.unstubAllEnvs());

describe('malva-bff-and-session › Connection health check', () => {
  it('Valid credentials: ok with the project key', async () => {
    get.mockResolvedValue({ body: { key: 'p', searchIndexing: { products: { status: 'Activated' } } } });
    expect(await (await GET()).json()).toEqual({ ok: true, projectKey: 'p', search: 'ok' });
  });
  it('reports missing search indexing instead of an empty listing', async () => {
    get.mockResolvedValue({ body: { key: 'p' } });
    expect(await (await GET()).json()).toMatchObject({ ok: true, search: 'indexing-missing' });
  });
  it('failure is {ok:false} with 500 and no detail', async () => {
    get.mockRejectedValue(new Error('secret leak'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
  it('Not shipped: 404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET()).status).toBe(404);
  });
});
