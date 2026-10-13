import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';

const catalogs = { 'de-DE': de, 'en-US': en } as const;
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: keyof typeof catalogs; namespace: string }) =>
    createTranslator({ locale, messages: catalogs[locale], namespace: namespace as 'common' }),
}));

import { titleMetadata, titleOf } from './page-title';

const APP = path.resolve(import.meta.dirname, '../../app/[locale]');
const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === 'page.tsx' ? [p] : [];
  });

describe('page titles are locale-aware and specific (WCAG 2.4.2)', () => {
  it('joins the most specific part first, in the request locale', async () => {
    expect(await titleMetadata('en-US', ['catalog.tabs', 'prices'], ['nav.items', 'catalog'])).toEqual({ title: 'Price overrides · Catalog & pricing' });
    expect(await titleMetadata('de-DE', ['nav.items', 'returns'])).toEqual({ title: 'Retouren' });
    expect(await titleOf(['auth.signIn', 'title'])({ params: Promise.resolve({ locale: 'de-DE' }) })).toEqual({ title: 'Anmelden' });
  });

  it('every page that renders content exports generateMetadata; only redirect pages are exempt', () => {
    const missing = pages(APP)
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return !/\bredirect\(/.test(text) && !/generateMetadata/.test(text);
      })
      .map((file) => path.relative(APP, file));
    expect(missing).toEqual([]);
  });

  it('every title part names a message that exists in both catalogues', () => {
    const lookup = (catalog: unknown, key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], catalog);
    const parts: [string, string][] = [];
    for (const file of pages(APP)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\[\s*'([\w.]+)'\s*,\s*'(\w+)'\s*\]/g)) if (/generateMetadata|titleMetadata/.test(text)) parts.push([m[1], m[2]]);
    }
    expect(parts.length).toBeGreaterThan(20);
    for (const [namespace, key] of parts) {
      for (const catalog of [de, en]) expect(typeof lookup(catalog, `${namespace}.${key}`), `${namespace}.${key}`).toBe('string');
    }
  });

  it('the root layout titles every route through the template', () => {
    expect(readFileSync(path.join(APP, '../layout.tsx'), 'utf8')).toContain("template: '%s | Malva Partner Portal'");
  });
});
