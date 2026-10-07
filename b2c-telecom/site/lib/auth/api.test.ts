// @vitest-environment node
vi.mock('@/lib/ct/bundle', () => ({ readBundle: vi.fn() }));
vi.mock('@/lib/ct/session', () => ({ updateSession: vi.fn() }));

import { authFailure, AuthRefusal, invalidCredentials, padResponse, rateLimited, readAuthBody } from './api';

const request = (body: string, headers: Record<string, string> = { 'content-type': 'application/json' }): Request => new Request('http://localhost/api/auth/login', { method: 'POST', headers, body });

describe('readAuthBody', () => {
  it('parses a JSON object', async () => {
    expect(await readAuthBody(request('{"email":"a@b.co"}'))).toEqual({ email: 'a@b.co' });
  });

  it('refuses another content type with 415', async () => {
    await expect(readAuthBody(request('x', { 'content-type': 'text/plain' }))).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('refuses a body above 4 KB with 413', async () => {
    await expect(readAuthBody(request(JSON.stringify({ a: 'x'.repeat(5000) })))).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('refuses invalid JSON and non-objects with 400', async () => {
    await expect(readAuthBody(request('{nope'))).rejects.toMatchObject({ status: 400, code: 'INVALID_INPUT' });
    await expect(readAuthBody(request('[1]'))).rejects.toMatchObject({ status: 400, code: 'INVALID_INPUT' });
  });
});

describe('responses', () => {
  it('invalidCredentials is 401 with the generic body and no-store', async () => {
    const res = invalidCredentials();
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Enter a valid email and password.' } });
  });

  it('rateLimited is 429 with Retry-After', async () => {
    const res = rateLimited(12.3);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('13');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
  });

  it('authFailure keeps a refusal and hides anything unexpected', async () => {
    expect((authFailure(new AuthRefusal(400, 'INVALID_INPUT', 'x'))).status).toBe(400);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = authFailure(new Error('secret password-token abc'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    log.mockRestore();
  });
});

describe('padResponse', () => {
  it('waits until the minimum time has passed', async () => {
    vi.useFakeTimers();
    const started = Date.now();
    let done = false;
    const pending = padResponse(started, 400).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(399);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
