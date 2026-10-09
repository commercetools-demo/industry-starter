import { readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETENTION_SECRET_HEADER } from '../../scripts/privacy/retention-handler';

// Y-03: every function that is publicly routable (/.netlify/functions/<name>) refuses a caller without the shared secret,
// and the scheduled wrappers do nothing without their configuration. This test walks the directory so a new function
// cannot be added without a guard.

const FUNCTIONS = readdirSync(import.meta.dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => f.replace(/\.ts$/, ''));
const SECRET = 'a-long-enough-test-secret-0123456789';

const GUARDED: Record<string, { env: string; header: string }> = {
  'auto-refill-run': { env: 'AUTO_REFILL_RUN_SECRET', header: 'x-refill-secret' },
  'reload-allowances': { env: 'RELOAD_ALLOWANCES_SECRET', header: 'x-malva-reload-secret' },
  retention: { env: 'RETENTION_SECRET', header: RETENTION_SECRET_HEADER },
};
const SCHEDULED = FUNCTIONS.filter((name) => name.endsWith('-scheduled'));

const call = (headers: Record<string, string> = {}, method = 'POST') => new Request('https://malva.example/.netlify/functions/x', { method, headers });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('netlify functions: secret-header guards (Y-03)', () => {
  it('every function is either a known guarded endpoint or a scheduled wrapper', () => {
    for (const name of FUNCTIONS) expect(Object.keys(GUARDED).includes(name) || SCHEDULED.includes(name), `${name} has no guard test`).toBe(true);
  });

  for (const [name, { env, header }] of Object.entries(GUARDED)) {
    describe(name, () => {
      it('without a configured secret it is closed (503) even for a caller sending the header', async () => {
        vi.stubEnv(env, '');
        vi.stubEnv('URL', 'https://malva.example');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const { default: handler } = await import(`./${name}`);
        expect((await handler(call({ [header]: 'anything' }))).status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('a secret under 16 characters counts as not configured', async () => {
        vi.stubEnv(env, 'short');
        vi.stubEnv('URL', 'https://malva.example');
        const { default: handler } = await import(`./${name}`);
        expect((await handler(call({ [header]: 'short' }))).status).toBe(503);
      });

      it('without the header, or with a wrong one, it refuses (401) and does not call out', async () => {
        vi.stubEnv(env, SECRET);
        vi.stubEnv('URL', 'https://malva.example');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const { default: handler } = await import(`./${name}`);
        expect((await handler(call())).status).toBe(401);
        expect((await handler(call({ [header]: `${SECRET}x` }))).status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });
  }

  for (const name of SCHEDULED) {
    it(`${name}: carries a cron, and does nothing without its secret or the site URL`, async () => {
      vi.stubEnv('RETENTION_SECRET', '');
      vi.stubEnv('RELOAD_ALLOWANCES_SECRET', '');
      vi.stubEnv('URL', '');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const mod = await import(`./${name}`);
      expect(mod.config.schedule).toMatch(/^\S+ \S+ \S+ \S+ \S+$/);
      expect((await mod.default()).status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('the retention schedule calls the guarded function with the secret header, and reports a failed run as 502', async () => {
    vi.stubEnv('RETENTION_SECRET', SECRET);
    vi.stubEnv('URL', 'https://malva.example/');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('./retention-scheduled');
    expect((await mod.default()).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith('https://malva.example/.netlify/functions/retention', { method: 'POST', headers: { [RETENTION_SECRET_HEADER]: SECRET } });
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect((await mod.default()).status).toBe(502);
  });
});
