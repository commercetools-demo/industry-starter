// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '@/next.config';

describe('malva-service-listing › Optional sector filter', () => {
  it('Filter by sector: ?sector= is rewritten to the static sector segment, keeping the public URL', async () => {
    const rewrites = (await config.rewrites!()) as { beforeFiles: Array<{ source: string; destination: string; has: Array<{ key: string; value: string }> }> };
    const rule = rewrites.beforeFiles[0]!;
    expect(rule.source).toBe('/:locale/:category(plumbing|waste-management)');
    expect(rule.has[0]).toMatchObject({ key: 'sector' });
    expect(rule.destination).toBe('/:locale/:category/sector/:sector');
    expect(new RegExp(`^${rule.has[0]!.value}$`).test('healthcare')).toBe(true);
    expect(new RegExp(`^${rule.has[0]!.value}$`).test('../x')).toBe(false);
  });
});
