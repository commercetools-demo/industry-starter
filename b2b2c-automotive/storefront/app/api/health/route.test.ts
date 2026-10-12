// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNoHealthInRelease } from '@/scripts/check-no-health-in-release.mjs';

const execute = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn(() => ({ execute })));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { get } }));

import { GET } from './route';

beforeEach(() => {
  execute.mockReset();
  get.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('Bootstrap acceptance: /api/health', () => {
  it('Valid credentials', async () => {
    execute.mockResolvedValue({ body: { key: 'spec-test-b2b2c-automotive', name: 'x' } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, projectKey: 'spec-test-b2b2c-automotive' });
  });

  it('Invalid credentials give 503 without details', async () => {
    execute.mockRejectedValue({ statusCode: 401, message: 'invalid_client secret-token-abc https://auth.example.test' });
    const res = await GET();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'commercetools unreachable or credentials invalid' });
    expect(text).not.toContain('secret-token-abc');
    expect(text).not.toContain('example.test');
  });

  it('Not shipped', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(get).not.toHaveBeenCalled();
  });
});

describe('Gates and tests: Release without health route', () => {
  it('Release without health route', () => {
    // The real file exists in this tree, so a release check must fail on it and a development check must pass.
    const check = (env: Record<string, string>) => checkNoHealthInRelease(process.cwd(), env as unknown as NodeJS.ProcessEnv);
    expect(check({ RELEASE: '1' })).toEqual(['app/api/health/route.ts must not exist in a release build']);
    expect(check({ NODE_ENV: 'production', CONTEXT: 'production' })).toHaveLength(1);
    expect(check({})).toEqual([]);
  });
});
