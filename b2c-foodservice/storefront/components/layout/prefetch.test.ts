// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Menu prefetch', () => {
  it.each(['MegaMenu.tsx', 'MobileNav.tsx', 'Footer.tsx'])('%s links do not prefetch dozens of listing pages on every page load', (file) => {
    const src = readFileSync(join(process.cwd(), 'components/layout', file), 'utf8');
    const links = src.match(/<Link\b/g)?.length ?? 0;
    expect(links).toBeGreaterThan(0);
    expect(src.match(/prefetch=\{false\}/g)?.length).toBe(links);
  });
});
