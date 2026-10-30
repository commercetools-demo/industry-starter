import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseConfig } from './next.config';

afterEach(() => vi.unstubAllEnvs());

describe('Image handling', () => {
  it('Images are unoptimized and https remote patterns are allowed', () => {
    expect(baseConfig.images?.unoptimized).toBe(true);
    expect(baseConfig.images?.remotePatterns).toEqual([{ protocol: 'https', hostname: '**' }]);
  });
  it('poweredByHeader is off and every route gets the security headers', async () => {
    expect(baseConfig.poweredByHeader).toBe(false);
    const rules = (await baseConfig.headers?.()) ?? [];
    expect(rules[0].source).toBe('/:path*');
    expect(rules[0].headers.map((h) => h.key)).toContain('Content-Security-Policy');
  });
  it('The security headers follow APP_MODE: camera and noindex only in instore mode (workstream R)', async () => {
    const headers = async (mode: string) => {
      vi.stubEnv('APP_MODE', mode);
      const rules = (await baseConfig.headers?.()) ?? [];
      return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    };
    const store = await headers('instore');
    expect(store['Permissions-Policy']).toContain('camera=(self)');
    expect(store['X-Robots-Tag']).toBe('noindex, nofollow');
    const site = await headers('website');
    expect(site['Permissions-Policy']).toContain('camera=()');
    expect(site['X-Robots-Tag']).toBeUndefined();
  });
  it('Metadata is in the head for every browser, not streamed into the body (SEO audit, previews)', () => {
    const bots = baseConfig.htmlLimitedBots as RegExp;
    expect(bots).toBeInstanceOf(RegExp);
    expect(bots.test('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe(true);
    expect(bots.test('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(true);
    expect(bots.test('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
  });
  // "Stored URL with a query" is tested where the URL is written: workstream C,
  // 'strips query and fragment from stored image URLs'.
});
