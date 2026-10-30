import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Preview and edit flags are the editor's: the storefront forwards a query string it received and never builds, links to,
 * redirects with or sets a header from `pb_preview`, `pb_page_id`, `pb_edit` or `pb_origin`. With no occurrence in the source
 * a shopper path cannot expose them (spec: page-builder-preview, "Shopper path").
 */
const FLAGS = /pb_(preview|page_id|edit|origin)/;
const ROOT = process.cwd();
const DIRS = ['app', 'components', 'lib', 'hooks', 'content', 'context', 'i18n', 'messages'];
const FILES = ['proxy.ts', 'next.config.ts', 'instrumentation.ts', 'instrumentation-node.ts'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.(ts|tsx|json|css|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('preview flags', () => {
  it('no storefront source builds or sets a page-builder preview or edit flag', () => {
    const files = [...DIRS.flatMap((d) => walk(join(ROOT, d))), ...FILES.map((f) => join(ROOT, f))];
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => FLAGS.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});
