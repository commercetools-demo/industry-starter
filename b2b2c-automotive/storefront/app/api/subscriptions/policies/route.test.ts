// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/recurrence-policies', () => ({ listRecurrencePolicies: list }));
vi.mock('@/lib/session', () => ({ getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));

import { GET } from './route';

afterEach(() => {
  list.mockReset();
  vi.unstubAllEnvs();
});

describe('GET /api/subscriptions/policies', () => {
  it('policy list comes from the server route', async () => {
    list.mockResolvedValue([{ key: 'mau-rp-monthly', label: 'Monthly' }]);
    const res = await GET();
    expect(await res.json()).toEqual({ policies: [{ key: 'mau-rp-monthly', label: 'Monthly' }] });
    expect(list).toHaveBeenCalledWith('en-US');
  });
  it('is empty without a commercetools call when subscriptions are off', async () => {
    vi.stubEnv('SUBSCRIPTIONS_PURCHASE_ENABLED', 'false');
    expect(await (await GET()).json()).toEqual({ policies: [] });
    expect(list).not.toHaveBeenCalled();
  });
});
