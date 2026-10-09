// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from './next.config';

describe('malva-data-loading › Portal and API routes are never cached', () => {
  it('Portal response headers: no-store on /api and the portal', async () => {
    const rules = await config.headers!();
    const noStore = (source: string) => rules.find((r) => r.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;
    expect(noStore('/api/:path*')).toBe('no-store');
    expect(noStore('/:locale/account/:path*')).toBe('no-store');
  });
});
