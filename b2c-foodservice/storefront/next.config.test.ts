import { describe, expect, it } from 'vitest';
import { baseConfig } from './next.config';

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
  // "Stored URL with a query" is tested where the URL is written: workstream C,
  // 'strips query and fragment from stored image URLs'.
});
