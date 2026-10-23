// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Menu prefetch', () => {
  // The header (primary links, logo, account), the menus, the footer and the breadcrumb are on almost every page: each prefetch
  // is a request of its own, twice per page (found by Q: 16 `_rsc` requests on a product page and on the confirmation page).
  it.each([
    'components/layout/MegaMenu.tsx',
    'components/layout/MobileNav.tsx',
    'components/layout/Footer.tsx',
    'components/layout/PrimaryNav.tsx',
    'components/layout/AccountMenu.tsx',
    'components/layout/Header.tsx',
    'components/listing/Breadcrumbs.tsx',
  ])('%s links do not prefetch on every page load', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    const links = src.match(/<Link\b/g)?.length ?? 0;
    expect(links).toBeGreaterThan(0);
    expect(src.match(/prefetch=\{false\}/g)?.length).toBe(links);
  });
});
