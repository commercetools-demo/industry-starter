import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchJson, jsonFetcher } from '@/hooks/fetcher';

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('fetchJson returns parsed JSON on 200', async () => {
    const fetchMock = vi.fn(async () => Response.json({ a: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchJson<{ a: number }>('/api/x')).toEqual({ a: 1 });
    expect(await jsonFetcher<{ a: number }>('/api/x')).toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', { credentials: 'same-origin' });
  });

  it('fetchJson throws ApiError with the server code on a JSON error body', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'conflict', message: 'm' } }, { status: 409 }));
    const err = await fetchJson('/api/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'conflict', status: 409 });
  });

  it('fetchJson throws ApiError internal_error on a non-JSON error', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>oops</html>', { status: 502 }));
    await expect(fetchJson('/api/x')).rejects.toMatchObject({ code: 'internal_error', status: 502 });
  });

  it('fetchJson maps a network failure to upstream_unavailable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchJson('/api/x')).rejects.toMatchObject({ code: 'upstream_unavailable', status: 0 });
  });
});
