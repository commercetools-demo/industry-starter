// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'mock-client-secret-value';
const execute = vi.fn();

vi.mock('@/lib/ct/client', () => ({
  apiRoot: { get: () => ({ execute }) },
}));
vi.mock('@/lib/env', () => ({
  getEnv: () => ({ EXPECTED_PROJECT_KEY: 'malva-test', CTP_CLIENT_SECRET: SECRET }),
}));

import { GET } from './route';

beforeEach(() => {
  execute.mockReset();
});

describe('GET /api/health', () => {
  it('Credentials valid: health returns 200 with the project key and no secret', async () => {
    execute.mockResolvedValue({ body: { key: 'malva-test', secretLeak: SECRET } });
    const res = await GET();
    const text = await res.clone().text();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, projectKey: 'malva-test' });
    expect(text).not.toContain(SECRET);
  });

  it('Health failure returns upstream_unavailable without details', async () => {
    execute.mockImplementation(async () => { throw new Error(`invalid_client ${SECRET} at /secret/path`); });
    const res = await GET();
    const text = await res.clone().text();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'upstream_unavailable', message: 'commercetools did not answer' },
    });
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('/secret/path');
  });

  it('Wrong project key from the API is reported', async () => {
    execute.mockResolvedValue({ body: { key: 'someone-else' } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'wrong_project', message: 'API reports key "someone-else", expected "malva-test"' },
    });
  });
});
