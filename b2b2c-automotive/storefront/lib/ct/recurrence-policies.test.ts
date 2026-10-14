// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { recurrencePolicies: () => ({ get: () => ({ execute: get }) }) }, projectKey: 'p' }));

const policy = (key: string, value: number, en: string) => ({ key, name: { 'en-US': en, 'de-DE': `${en} de` }, schedule: { type: 'standard', value, intervalUnit: 'Months' } });

describe('listRecurrencePolicies', () => {
  beforeEach(() => {
    vi.resetModules();
    get.mockReset();
  });

  it('lists only mau-rp policies, shortest interval first, names localized', async () => {
    get.mockResolvedValue({ body: { results: [policy('mau-rp-half-yearly', 6, 'Every 6 months'), policy('other-policy', 1, 'Other'), policy('mau-rp-monthly', 1, 'Monthly'), policy('mau-rp-quarterly', 3, 'Every 3 months')] } });
    const { listRecurrencePolicies } = await import('./recurrence-policies');
    expect(await listRecurrencePolicies('en-US')).toEqual([
      { key: 'mau-rp-monthly', label: 'Monthly' },
      { key: 'mau-rp-quarterly', label: 'Every 3 months' },
      { key: 'mau-rp-half-yearly', label: 'Every 6 months' },
    ]);
    expect((await listRecurrencePolicies('de-DE'))[0].label).toBe('Monthly de');
  });

  it('caches for an hour per locale and serves the last list when commercetools fails', async () => {
    get.mockResolvedValue({ body: { results: [policy('mau-rp-monthly', 1, 'Monthly')] } });
    const { listRecurrencePolicies } = await import('./recurrence-policies');
    await listRecurrencePolicies('en-US');
    await listRecurrencePolicies('en-US');
    expect(get).toHaveBeenCalledTimes(1);
    get.mockRejectedValue(new Error('down'));
    expect((await listRecurrencePolicies('en-US')).length).toBe(1);
  });
});
