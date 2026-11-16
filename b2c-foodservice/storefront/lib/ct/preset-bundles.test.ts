// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ customObjects: [] as unknown[] }));

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customObjects: () => ({
      get: (args: unknown) => {
        calls.customObjects.push(args);
        return { execute: async () => ({ body: { results: [] } }) };
      },
    }),
  },
}));

import { getBundleConfig } from '@/lib/ct/preset-bundles';

beforeEach(() => {
  calls.customObjects.length = 0;
});

describe('getBundleConfig (V-07)', () => {
  it('a malformed id never reaches the API', async () => {
    expect(await getBundleConfig('x"; delete')).toBeNull();
    expect(await getBundleConfig('')).toBeNull();
    expect(calls.customObjects).toHaveLength(0);
  });

  it('a UUID is read by id with a limit of one', async () => {
    await getBundleConfig('9790d294-a6c3-4a54-9391-841b1a7ab85a');
    expect(calls.customObjects).toEqual([{ queryArgs: { where: 'id="9790d294-a6c3-4a54-9391-841b1a7ab85a"', limit: 1 } }]);
  });
});
