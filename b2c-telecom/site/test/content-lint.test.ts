// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getFaq } from '@/lib/content/faq';
import { parseFrontMatter } from '@/lib/content/frontmatter';
import { LEGAL_SLUGS } from '@/lib/content/policies';

const ROOT = path.join(process.cwd(), 'content');
const LOCALES = ['en-US', 'de-DE'] as const;

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}
const read = (file: string) => readFileSync(file, 'utf8');
const slugs = (locale: string) => files(path.join(ROOT, locale, 'blog')).map((f) => path.basename(f, '.md')).sort();

describe('content lint', () => {
  it('faq, about and blog files contain no currency symbol, currency code or day count', () => {
    const prose = LOCALES.flatMap((locale) => [path.join(ROOT, locale, 'about.md'), path.join(ROOT, locale, 'faq.md'), ...files(path.join(ROOT, locale, 'blog'))]);
    expect(prose.length).toBe(10);
    for (const file of prose) {
      const text = read(file);
      expect(text, file).not.toMatch(/[$€]|\b(?:USD|EUR)\b/);
      expect(text, file).not.toMatch(/\d+\s*(?:business days|days?|Werktage|Tage?)\b/i);
    }
  });

  it('every blog slug exists in both locales and matches [a-z0-9-]+', () => {
    expect(slugs('en-US')).toEqual(slugs('de-DE'));
    expect(slugs('en-US')).toHaveLength(3);
    for (const slug of slugs('en-US')) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('all FAQ topic and question ids are identical across locales', () => {
    const ids = (locale: 'en-US' | 'de-DE') => getFaq(locale)!.topics.flatMap((t) => [t.id, ...t.items.map((i) => i.id)]);
    expect(ids('de-DE')).toEqual(ids('en-US'));
    expect(new Set(ids('en-US')).size).toBe(ids('en-US').length);
  });

  it('every policy folder has the same version dates in both locales', () => {
    for (const policy of LEGAL_SLUGS) {
      const dates = (locale: string) => files(path.join(ROOT, locale, 'legal', policy)).map((f) => path.basename(f, '.md')).sort();
      expect(dates('de-DE'), policy).toEqual(dates('en-US'));
      expect(dates('en-US').length, policy).toBeGreaterThan(0);
    }
  });

  it('page files carry the front matter keys of their kind in both locales', () => {
    for (const locale of LOCALES) {
      for (const page of ['about', 'faq', 'support']) {
        const { data } = parseFrontMatter(read(path.join(ROOT, locale, `${page}.md`)));
        expect(data.title, `${locale}/${page}`).toBeTruthy();
        expect(data.description, `${locale}/${page}`).toBeTruthy();
      }
    }
  });

  it('internal markdown links resolve to existing routes', () => {
    const blog = new Set(slugs('en-US'));
    const policies = new Set<string>(LEGAL_SLUGS);
    const all = LOCALES.flatMap((locale) => files(path.join(ROOT, locale)).filter((f) => f.endsWith('.md')));
    let checked = 0;
    for (const file of all) {
      for (const match of read(file).matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const href = match[1];
        checked += 1;
        const ok =
          ['/faq', '/support', '/about', '/blog'].includes(href) ||
          (href.startsWith('/blog/') && blog.has(href.slice('/blog/'.length))) ||
          (href.startsWith('/legal/') && policies.has(href.slice('/legal/'.length))) ||
          /^\/shop\/[a-z0-9-]+$/.test(href);
        expect(ok, `${path.relative(ROOT, file)}: ${href}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('no content file links with a locale prefix (the renderer adds it)', () => {
    for (const file of LOCALES.flatMap((locale) => files(path.join(ROOT, locale)))) {
      expect(read(file), file).not.toMatch(/\]\(\/(?:en-US|de-DE)\//);
    }
  });
});
