// @vitest-environment node
import config from './next.config';

describe('next.config', () => {
  it('Optimizer disabled', () => {
    expect(config.images?.unoptimized).toBe(true);
  });

  it('allows storefront image hosts', () => {
    const hosts = (config.images?.remotePatterns ?? []).map((p) => ('hostname' in p ? p.hostname : ''));
    expect(hosts).toContain('storage.googleapis.com');
    expect(hosts).toContain('**');
  });

  it('checkout and confirmation pages are private and never stored', async () => {
    const rules = (await config.headers?.()) ?? [];
    const rule = rules.find((r) => r.source === '/:locale/checkout/:path*');
    expect(rule?.headers).toContainEqual({ key: 'Cache-Control', value: 'private, no-store' });
  });

  it('bundles the markdown content with the server functions', () => {
    expect(config.outputFileTracingIncludes?.['/**']).toContain('./content/**/*');
  });
});
