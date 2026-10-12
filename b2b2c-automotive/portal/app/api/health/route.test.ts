// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNoHealthInRelease } from '@/scripts/check-no-health-in-release.mjs';

const sdk = vi.hoisted(() => ({ get: vi.fn(), admin: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({ apiRoot: { get: () => ({ execute: () => sdk.get() }) } }));
vi.mock('@/lib/ct/seller/health', () => ({ probeAdmin: () => sdk.admin() }));

beforeEach(() => {
  sdk.get.mockReset();
  sdk.admin.mockReset();
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('Bootstrap acceptance: /api/health', () => {
  it('Valid credentials', async () => {
    sdk.get.mockResolvedValue({ body: { key: 'spec-test-b2b2c-automotive' } });
    sdk.admin.mockResolvedValue(true);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, projectKey: 'spec-test-b2b2c-automotive', frontend: true, admin: true, provisioning: 'configured' });
  });

  it('Provisioning missing is reported from the environment only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CTP_PROVISION_CLIENT_ID', '');
    sdk.get.mockResolvedValue({ body: { key: 'p' } });
    sdk.admin.mockResolvedValue(true);
    const { GET } = await import('./route');
    expect(await (await GET()).json()).toMatchObject({ ok: true, provisioning: 'missing' });
  });

  it('Invalid credentials give 503 without details', async () => {
    sdk.get.mockRejectedValue({ statusCode: 401, message: 'invalid_client: secret-xyz', body: { error: 'invalid_client' } });
    sdk.admin.mockResolvedValue(true);
    const { GET } = await import('./route');
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({ ok: false, error: 'commercetools unreachable or credentials invalid', frontend: false });
    expect(text).not.toContain('secret-xyz');
    expect(text).not.toContain('invalid_client');
  });

  it('Admin probe failure is reported but not detailed', async () => {
    sdk.get.mockResolvedValue({ body: { key: 'p' } });
    sdk.admin.mockResolvedValue(false);
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, frontend: true, admin: false, provisioning: 'configured', error: 'commercetools unreachable or credentials invalid' });
  });

  it('Missing configuration is a 503 without the variable value', async () => {
    vi.stubEnv('CTP_ADMIN_CLIENT_SECRET', '');
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(503);
    expect(sdk.get).not.toHaveBeenCalled();
  });

  it('Not shipped', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(sdk.get).not.toHaveBeenCalled();
    expect(sdk.admin).not.toHaveBeenCalled();
  });

  it('Release without health route', () => {
    // The real file exists, so a release build must fail the gate.
    const env = (extra: Record<string, string>) => ({ NODE_ENV: 'development', ...extra }) as NodeJS.ProcessEnv;
    const problems = checkNoHealthInRelease(process.cwd(), env({ RELEASE: '1' }));
    expect(problems).toEqual(['app/api/health/route.ts must not exist in a release build (RELEASE=1 or production context)']);
    expect(checkNoHealthInRelease(process.cwd(), env({}))).toEqual([]);
  });
});
