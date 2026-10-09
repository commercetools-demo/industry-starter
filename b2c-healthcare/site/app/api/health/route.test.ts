// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkNoHealthInRelease } from '../../../scripts/check-no-health-in-release.mjs';

const checkConnection = vi.fn();
vi.mock('@/lib/ct/health', () => ({ checkConnection: () => checkConnection() }));

import { GET } from './route';

const real = resolve(import.meta.dirname, '../../..');
const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  checkConnection.mockReset();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('storefront-bff-and-session: Connection health check', () => {
  it('Valid credentials: returns { ok: true, projectKey }', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    checkConnection.mockResolvedValue({ projectKey: 'spec-test-b2c-healthcare' });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, projectKey: 'spec-test-b2c-healthcare' });
  });

  it('Valid credentials: a failing call returns { ok: false } with 500 and no detail', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    checkConnection.mockRejectedValue(new Error('invalid_client secret=abc'));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
  });

  it('Not shipped: production responds 404 and calls nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await GET();
    expect(response.status).toBe(404);
    expect(checkConnection).not.toHaveBeenCalled();
  });

  it('Not shipped: the release check passes in dev and fails on a production build with the file present', () => {
    expect(checkNoHealthInRelease(real, { NODE_ENV: 'development' })).toEqual([]);
    const problems = checkNoHealthInRelease(real, { NODE_ENV: 'production' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('app/api/health/route.ts');
  });

  it('Not shipped: no file means a release build passes; an unguarded file fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'health-'));
    dirs.push(root);
    expect(checkNoHealthInRelease(root, { NODE_ENV: 'production' })).toEqual([]);
    mkdirSync(join(root, 'app/api/health'), { recursive: true });
    writeFileSync(join(root, 'app/api/health/route.ts'), 'export function GET() { return Response.json({}); }');
    expect(checkNoHealthInRelease(root, { NODE_ENV: 'development' })).toHaveLength(1);
  });
});
