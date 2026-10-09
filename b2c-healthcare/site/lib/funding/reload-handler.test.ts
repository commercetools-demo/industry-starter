// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleReload, RELOAD_SECRET_HEADER } from './reload-handler';

const result = { members: 3, granted: 2, lapsedCycles: 1, lapsedCents: 500 };
const post = (headers: Record<string, string> = {}, method = 'POST') => new Request('https://example.test/.netlify/functions/reload-allowances', { method, headers });

describe('benefit-allowance-drawdown: the scheduled reload endpoint is guarded by a secret header (U-07)', () => {
  it('without the secret header: 401 and nothing runs', async () => {
    const run = vi.fn(async () => result);
    const response = await handleReload(post(), { run, secret: 's3cret-0123456789' });
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('with the wrong secret: 401 and nothing runs', async () => {
    const run = vi.fn(async () => result);
    expect((await handleReload(post({ [RELOAD_SECRET_HEADER]: 'nope' }), { run, secret: 's3cret-0123456789' })).status).toBe(401);
    expect((await handleReload(post({ [RELOAD_SECRET_HEADER]: 's3cret-0123456789-longer' }), { run, secret: 's3cret-0123456789' })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('with no secret configured the endpoint is closed (503), even for a caller that sends a header', async () => {
    const run = vi.fn(async () => result);
    expect((await handleReload(post({ [RELOAD_SECRET_HEADER]: 'anything' }), { run, secret: undefined })).status).toBe(503);
    expect((await handleReload(post({ [RELOAD_SECRET_HEADER]: '' }), { run, secret: '' })).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it('only POST: a GET is 405 and nothing runs', async () => {
    const run = vi.fn(async () => result);
    expect((await handleReload(post({ [RELOAD_SECRET_HEADER]: 's3cret-0123456789' }, 'GET'), { run, secret: 's3cret-0123456789' })).status).toBe(405);
    expect(run).not.toHaveBeenCalled();
  });

  it('with the secret: runs once with the clock and answers counts only', async () => {
    const run = vi.fn(async () => result);
    const now = new Date('2026-11-01T00:10:00Z');
    const response = await handleReload(post({ [RELOAD_SECRET_HEADER]: 's3cret-0123456789' }), { run, secret: 's3cret-0123456789', now: () => now });
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(now);
    expect(await response.json()).toEqual({ ok: true, ...result });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('a failing reload is a 502 without the error text, and is safe to run again', async () => {
    const response = await handleReload(post({ [RELOAD_SECRET_HEADER]: 's3cret-0123456789' }), { run: async () => { throw new Error('pt_8k2m4q7x exploded'); }, secret: 's3cret-0123456789' });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('pt_8k2m4q7x');
  });
});

describe('the Netlify functions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('the guarded function refuses without a configured secret and does not build a client', async () => {
    vi.stubEnv('RELOAD_ALLOWANCES_SECRET', '');
    const { default: handler } = await import('../../netlify/functions/reload-allowances');
    expect((await handler(post({ [RELOAD_SECRET_HEADER]: 'x' }))).status).toBe(503);
  });

  it('the guarded function refuses a caller without the header', async () => {
    vi.stubEnv('RELOAD_ALLOWANCES_SECRET', 's3cret-0123456789');
    const { default: handler } = await import('../../netlify/functions/reload-allowances');
    expect((await handler(post())).status).toBe(401);
  });

  it('the schedule is monthly and calls the guarded function with the secret header', async () => {
    vi.stubEnv('RELOAD_ALLOWANCES_SECRET', 's3cret-0123456789');
    vi.stubEnv('URL', 'https://malva.example');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('../../netlify/functions/reload-allowances-scheduled');
    expect(mod.config.schedule).toBe('10 0 1 * *');
    expect((await mod.default()).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith('https://malva.example/.netlify/functions/reload-allowances', { method: 'POST', headers: { [RELOAD_SECRET_HEADER]: 's3cret-0123456789' } });
  });

  it('the schedule does nothing when the secret or site URL is missing', async () => {
    vi.stubEnv('RELOAD_ALLOWANCES_SECRET', '');
    vi.stubEnv('URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('../../netlify/functions/reload-allowances-scheduled');
    expect((await mod.default()).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
