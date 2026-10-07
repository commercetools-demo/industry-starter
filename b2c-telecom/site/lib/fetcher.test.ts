import { ApiError } from './api-error';
import { fetchJson, sendJson } from './fetcher';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('fetchJson', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ a: 1 })));
    expect(await fetchJson<{ a: number }>('/api/x')).toEqual({ a: 1 });
  });

  it('throws ApiError with status and code from the body on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ error: { code: 'CONFLICT', message: 'Changed' } }, 409)));
    const error = await fetchJson('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('CONFLICT');
    expect((error as ApiError).message).toBe('Changed');
  });

  it('maps a network error to UPSTREAM_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const error = await fetchJson('/api/x').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('UPSTREAM_ERROR');
  });

  it('maps a non-JSON failure to UPSTREAM_ERROR, using the status for known codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond('<html>oops</html>', 502)));
    expect(((await fetchJson('/api/x').catch((e: unknown) => e)) as ApiError).code).toBe('UPSTREAM_ERROR');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond('nope', 404)));
    expect(((await fetchJson('/api/x').catch((e: unknown) => e)) as ApiError).code).toBe('NOT_FOUND');
  });
});

describe('sendJson', () => {
  it('sends the method and a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await sendJson('/api/x', 'POST', { a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it('omits the body when none is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await sendJson('/api/x', 'DELETE');
    expect(fetchMock).toHaveBeenCalledWith('/api/x', { method: 'DELETE' });
  });
});
