// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cacheOptions } = vi.hoisted(() => ({ cacheOptions: [] as unknown[] }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, _keys: unknown, options: unknown) => {
    cacheOptions.push(options);
    return fn;
  },
}));
const execute = vi.fn();
vi.mock('@/lib/ct/client', () => ({ apiRoot: { get: () => ({ execute }) } }));

import { getProjectSettings, PROJECT_SETTINGS_REVALIDATE_SECONDS } from './project';

describe('storefront-data-loading: project settings', () => {
  beforeEach(() => execute.mockReset());

  it('is cached for 300 seconds', () => {
    expect(PROJECT_SETTINGS_REVALIDATE_SECONDS).toBe(300);
    expect(cacheOptions[0]).toEqual({ revalidate: 300 });
  });

  it('maps countries, currencies and languages only', async () => {
    execute.mockResolvedValue({ body: { key: 'k', countries: ['US'], currencies: ['USD'], languages: ['en-US'], secret: 'x' } });
    expect(await getProjectSettings()).toEqual({ countries: ['US'], currencies: ['USD'], languages: ['en-US'] });
  });
});
