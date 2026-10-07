// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { errorResponse, json } from './http';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorResponse', () => {
  it('maps an ApiError to its status and body', async () => {
    const res = errorResponse(new ApiError('NOT_FOUND', 'x'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'x' } });
  });

  it('maps a ConcurrentModification SDK error to CONFLICT', async () => {
    const res = errorResponse({ statusCode: 409 });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('CONFLICT');
  });

  it('maps SDK 404 and 400', async () => {
    expect(errorResponse({ statusCode: 404 }).status).toBe(404);
    const res = errorResponse({ statusCode: 400, body: { message: 'internal detail' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'VALIDATION', message: 'Invalid request' } });
  });

  it('hides upstream detail behind a 502', async () => {
    const res = errorResponse({ statusCode: 500, body: { message: 'secret detail' } });
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('The service is temporarily unavailable');
    expect(text).not.toContain('secret detail');
  });

  it('maps network failures to 502', async () => {
    expect(errorResponse(new TypeError('fetch failed')).status).toBe(502);
  });

  it('maps an unknown Error to INTERNAL without its message', async () => {
    const res = errorResponse(new Error('boom with secret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('boom');
  });

  it('adds Retry-After for a rate limited error', () => {
    const res = errorResponse(new ApiError('RATE_LIMITED', 'Too many', { retryAfterSeconds: 12 }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('12');
  });
});

describe('json', () => {
  it('sets no-store', () => {
    expect(json({ a: 1 }).headers.get('cache-control')).toBe('no-store');
  });
});
