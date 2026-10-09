// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { expectNoBusinessUnit, expectSanitizedError, expectUnauthenticated, sessionMock } from '../test/api-helpers';

vi.mock('./session', () => ({ getSession: async () => sessionMock.current }));

const { handle, isCrossSite, ok, requireBusinessUnit, requireCustomer } = await import('./api');

const ct = vi.fn();
const accountHandler = handle(async () => { await requireCustomer(); ct(); return ok({ data: 1 }); });
const unitHandler = handle(async () => { await requireBusinessUnit(); ct(); return ok({ data: 1 }); });
const failing = handle(async () => { await requireBusinessUnit(); throw Object.assign(new Error('Authorization: Bearer abc SDK-INTERNAL secret'), { body: { secret: 1 } }); });

describe('malva-bff-and-session › Route Handler boundary', () => {
  it('Unauthenticated access to account data', async () => { await expectUnauthenticated(accountHandler, ct); });
  it('Business unit required', async () => { await expectNoBusinessUnit(unitHandler, ct); });
  it('Failure shape', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectSanitizedError(failing);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Bearer|secret/);
    spy.mockRestore();
  });
  it('No SDK in handlers', () => {
    const dir = path.join(process.cwd(), 'app/api');
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const offenders = walk(dir).filter((f) => !f.endsWith('health/route.ts') && !/\.test\./.test(f)).filter((f) => /apiRoot|provisioningRoot|platform-sdk/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('malva-bff-and-session › Cross-site requests', () => {
  const req = (method: string, headers: Record<string, string> = {}) => new Request('https://malva.example/api/x', { method, headers });
  it('refuses a cross-site write, however the browser says so', () => {
    expect(isCrossSite(req('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSite(req('POST', { 'sec-fetch-site': 'same-site' }))).toBe(true);
    expect(isCrossSite(req('POST', { origin: 'https://evil.example', host: 'malva.example' }))).toBe(true);
  });
  it('allows same-origin writes, reads, and clients that send neither header', () => {
    expect(isCrossSite(req('POST', { 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSite(req('POST', { origin: 'https://malva.example', host: 'malva.example' }))).toBe(false);
    expect(isCrossSite(req('POST'))).toBe(false);
    expect(isCrossSite(req('GET', { 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });
  it('handle() answers 403 and does not run the handler', async () => {
    const run = vi.fn(async () => ok({ ok: true }));
    const res = await handle(async (r: Request) => { void r; return run(); })(req('POST', { 'sec-fetch-site': 'cross-site' }));
    expect(res.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });
});
