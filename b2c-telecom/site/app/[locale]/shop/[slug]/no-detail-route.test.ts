// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// D-052: there is no product detail page. A product-shaped URL has no route file, so the only thing that can answer it is the
// locale catch-all of workstream I, which calls `notFound()` (the standard 404 page with the full frame).

const LOCALE_DIR = path.resolve(__dirname, '../..');
const FORBIDDEN_DIRECTORIES = new Set(['p', 'product', 'products', 'item', 'items', 'offer', 'offers', '[productSlug]', '[productId]', '[offerKey]', '[sku]']);

function directories(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const full = path.join(root, name);
    return statSync(full).isDirectory() ? [full, ...directories(full)] : [];
  });
}

describe('no detail route', () => {
  it('No detail route exists: no product route files, standard not-found is the only resolution', () => {
    const offenders = directories(LOCALE_DIR).filter((dir) => FORBIDDEN_DIRECTORIES.has(path.basename(dir)));
    expect(offenders.map((dir) => path.relative(LOCALE_DIR, dir))).toEqual([]);
    // `/shop` alone is not a page (the header and tiles always link to a category), and a category has no child routes.
    expect(existsSync(path.join(LOCALE_DIR, 'shop', 'page.tsx'))).toBe(false);
    expect(directories(path.join(LOCALE_DIR, 'shop')).map((dir) => path.relative(path.join(LOCALE_DIR, 'shop'), dir))).toEqual(['[slug]']);
    const catchAll = readFileSync(path.join(LOCALE_DIR, '[...rest]', 'page.tsx'), 'utf8');
    expect(catchAll).toMatch(/notFound\(\)/);
  });

  it('the listing is the only page under shop', () => {
    expect(existsSync(path.join(LOCALE_DIR, 'shop', '[slug]', 'page.tsx'))).toBe(true);
  });
});
