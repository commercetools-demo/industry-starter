// @vitest-environment node
import securityHeaders from './security-headers.json';

async function loadConfig() {
  vi.resetModules();
  return (await import('../next.config')).default;
}

describe('security headers', () => {
  it('is an array of the five { key, value } pairs without newlines', () => {
    expect(securityHeaders.map((header) => header.key)).toEqual([
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
    ]);
    for (const header of securityHeaders) {
      expect(Object.keys(header).sort()).toEqual(['key', 'value']);
      expect(header.value).not.toMatch(/[\r\n]/);
    }
  });

  it('next.config headers() serves the five security headers', async () => {
    const config = await loadConfig();
    const rules = (await config.headers?.()) ?? [];
    const rule = rules.find((entry) => entry.source === '/:path*');
    expect(rule?.headers).toEqual(securityHeaders);
  });
});
