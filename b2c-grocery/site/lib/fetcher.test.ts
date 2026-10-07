import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, fetchJson, sendJson } from './fetcher';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('ok: returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ cart: null })));
    expect(await fetchJson('/api/cart')).toEqual({ cart: null });
  });

  it('non-2xx: throws ApiError with the message and data from the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'INSUFFICIENT_STOCK', available: 3 }, 409)));
    const err = await fetchJson('/api/cart').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.message).toBe('INSUFFICIENT_STOCK');
    expect(apiError.status).toBe(409);
    expect((apiError.data as { available: number }).available).toBe(3);
  });

  it('non-2xx without a JSON body: generic message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(fetchJson('/x')).rejects.toMatchObject({ status: 500, message: 'Request failed (500)' });
  });

  it('network error: propagates unchanged', async () => {
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    await expect(fetchJson('/x')).rejects.toBe(failure);
  });
});

describe('sendJson', () => {
  it('sends a JSON body with the method and content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendJson('/api/cart/lines', 'POST', { sku: 'A' })).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/cart/lines');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ sku: 'A' }));
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('no body: sends none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal('fetch', fetchMock);
    await sendJson('/api/x', 'DELETE');
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBeUndefined();
  });

  it('error: throws ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Nope' }, 400)));
    await expect(sendJson('/api/x', 'POST', {})).rejects.toBeInstanceOf(ApiError);
  });
});
