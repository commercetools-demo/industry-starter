// @vitest-environment node
async function loadConfig(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  return (await import('./next.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config', () => {
  it('narrows remote images to the allowed hosts and disables the optimiser', async () => {
    const config = await loadConfig('production');
    expect(config.images?.unoptimized).toBe(true);
    const hostnames = (config.images?.remotePatterns ?? []).map((pattern) => (pattern instanceof URL ? pattern.hostname : pattern.hostname));
    expect(hostnames).toEqual(['images.pexels.com', 'media.istockphoto.com', 'storage.googleapis.com']);
    expect(hostnames.some((hostname) => hostname.includes('**'))).toBe(false);
  });

  it('sends Cache-Control: no-store for the four auth pages', async () => {
    const config = await loadConfig('production');
    const rules = (await config.headers?.()) ?? [];
    expect(rules).toEqual([{ source: '/:locale/(login|register|forgot-password|reset-password)', headers: [{ key: 'Cache-Control', value: 'no-store' }] }]);
  });

  it('includes dev.ts page extensions in development only', async () => {
    const dev = await loadConfig('development');
    expect(dev.pageExtensions).toContain('dev.ts');
    const prod = await loadConfig('production');
    expect(prod.pageExtensions).not.toContain('dev.ts');
  });
});
