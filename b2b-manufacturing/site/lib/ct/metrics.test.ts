// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metricsEnabled, metricsMiddleware } from './metrics';

afterEach(() => vi.unstubAllEnvs());
describe('malva-data-loading › Call metrics', () => {
  it('is off unless asked for, and never on in production', () => {
    expect(metricsEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(metricsEnabled({ NODE_ENV: 'development', CT_METRICS: '1' })).toBe(true);
    expect(metricsEnabled({ NODE_ENV: 'production', CT_METRICS: '1' })).toBe(false);
  });
  it('logs method and path without the query string', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('CT_METRICS', '1');
    const lines: string[] = [];
    const mw = metricsMiddleware((l) => lines.push(l))!;
    await mw(async (r) => ({ ...r }) as never)({ method: 'POST', uri: '/p/products/search?x=1' } as never);
    expect(lines[0]).toMatch(/^\[ct\] POST \/p\/products\/search \d+ms/);
  });
  it('returns nothing when disabled', () => { vi.stubEnv('CT_METRICS', ''); expect(metricsMiddleware()).toBeUndefined(); });
});
