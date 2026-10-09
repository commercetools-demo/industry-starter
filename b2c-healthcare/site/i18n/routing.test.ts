import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import messages from '../messages/en-US.json';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { routing } from './routing';

describe('storefront-locale-routing: routing configuration', () => {
  it('Single source: routing locales derive from COUNTRY_CONFIG', () => {
    expect([...routing.locales]).toEqual(Object.keys(COUNTRY_CONFIG));
    expect(routing.defaultLocale).toBe('en-US');
  });

  it('Locale-prefixed routes: the prefix is always present', () => {
    expect(routing.localePrefix).toBe('always');
  });

  it('exports the locale-aware navigation helpers', async () => {
    const navigation = await import('./routing');
    for (const name of ['Link', 'redirect', 'usePathname', 'useRouter', 'getPathname'] as const) {
      expect(navigation[name]).toBeDefined();
    }
  });

  it('the catalog starts with the common and errors namespaces', () => {
    expect(Object.keys(messages)).toEqual(expect.arrayContaining(['common', 'errors']));
  });

  it('next.config: unoptimized images and the commercetools CDN as remote host', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
    expect(nextConfig.images?.remotePatterns?.map((pattern) => (pattern as { hostname: string }).hostname)).toEqual([
      'storage.googleapis.com',
    ]);
  });
});
