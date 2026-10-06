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
});
