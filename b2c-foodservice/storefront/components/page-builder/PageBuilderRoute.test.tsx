import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageBuilderRoute } from './PageBuilderRoute';

const NO_PAGE = 'NO_PAGE';
const FAILED = 'FAILED';
const env = { PB_SERVICE_URL: 'https://pb.example.test/service', PB_RENDER_KEY: 'key-for-tests-only', PB_ORIGIN: 'https://shop.example.test' };

function reply(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}
async function run(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof PageBuilderRoute>[0]> = {}) {
  return PageBuilderRoute({ locale: 'en-US', fallback: NO_PAGE, errorFallback: FAILED, fetchImpl, ...extra });
}

beforeEach(() => {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('outcome classification', () => {
  it('no page: 404 page_not_found gets the no-page fallback and logs nothing', async () => {
    expect(await run(reply(404, { error: { code: 'page_not_found', message: 'x' } }))).toBe(NO_PAGE);
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    ['a 404 with another code (wrong URL)', 404, { error: { code: 'not_found', message: 'Route not found' } }],
    ['invalid render key', 401, { error: { code: 'invalid_render_key', message: 'x' } }],
    ['origin not allowed', 403, { error: { code: 'origin_not_allowed', message: 'x' } }],
    ['wire version not supported', 426, { error: { code: 'upgrade_required', supported: [2] } }],
    ['a server error', 500, { error: { code: 'internal', message: 'x' } }],
    ['an unparsable body', 200, 'not json'],
  ])('failure: %s gets the error fallback and is logged', async (_name, status, body) => {
    expect(await run(reply(status, body))).toBe(FAILED);
    expect(console.error).toHaveBeenCalled();
  });

  it('failure: a network error gets the error fallback and is logged', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await run(down)).toBe(FAILED);
    expect(console.error).toHaveBeenCalled();
  });

  it('failure: a call slower than PB_TIMEOUT_MS gets the error fallback', async () => {
    vi.stubEnv('PB_TIMEOUT_MS', '20');
    const slow = vi.fn((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    ) as unknown as typeof fetch;
    expect(await run(slow)).toBe(FAILED);
  });
});

describe('the render call', () => {
  const ok = { wireVersion: 1, preview: false, editMode: false, sections: [] };

  async function urlOf(locale: string, segments: string[] | undefined, searchParams?: Record<string, string>) {
    const f = reply(200, ok);
    await run(f, { locale, ...(segments ? { segments } : {}), ...(searchParams ? { searchParams } : {}) });
    const call = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    return { url: new URL(String(call[0])), headers: new Headers((call[1] as RequestInit).headers) };
  }

  it('sends the path without the locale and the market of the URL locale, never a store', async () => {
    const { url } = await urlOf('en-CA', ['category', 'pods']);
    expect(url.searchParams.get('path')).toBe('/category/pods');
    expect(url.searchParams.get('locale')).toBe('en-CA');
    expect(url.searchParams.get('currency')).toBe('CAD');
    expect(url.searchParams.get('country')).toBe('CA');
    expect(url.searchParams.has('store')).toBe(false);
  });

  it('sends / for the home page', async () => {
    expect((await urlOf('en-US', undefined)).url.searchParams.get('path')).toBe('/');
  });

  it('forwards the query string as one value', async () => {
    const { url } = await urlOf('en-US', ['category', 'pods'], { sort: 'price-asc', 'facet.roast': 'dark' });
    expect(url.searchParams.get('search')).toBe('sort=price-asc&facet.roast=dark');
  });

  it('presents the render key, the origin and wire version 1', async () => {
    const { headers } = await urlOf('en-US', undefined);
    expect(headers.get('X-PB-Render-Key')).toBe(env.PB_RENDER_KEY);
    expect(headers.get('X-PB-Origin')).toBe(env.PB_ORIGIN);
    expect(headers.get('X-PB-Wire-Version')).toBe('1');
  });

  it('disables HTTP caching of the call', async () => {
    const f = reply(200, ok);
    await run(f);
    expect(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).cache).toBe('no-store');
  });
});

describe('configuration', () => {
  it('a missing service URL in production logs the problem and renders the error fallback', async () => {
    vi.stubEnv('PB_SERVICE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await run(reply(200, {}))).toBe(FAILED);
    expect(console.error).toHaveBeenCalled();
  });
});
