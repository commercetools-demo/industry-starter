import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { optionalString, parseFrontMatter, requireString, stringList } from './frontmatter';
import { renderMarkdown } from './markdown';
import { ContentError, DATE_PATTERN, FALLBACK_LOCALE, SLUG_PATTERN, contentRoot, isContentLocale, type ContentLocale, type ContentOptions } from './types';

export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  servedLocale: ContentLocale;
  fallback: boolean;
}
export interface Article extends ArticleSummary {
  html: string;
}
export type ArticleResult = { kind: 'article'; article: Article } | { kind: 'withdrawn'; slug: string; topic: string } | null;

type Loaded = { kind: 'published'; article: Article } | { kind: 'withdrawn'; slug: string; topic: string };

const TAG_PATTERN = /^[a-z0-9-]{1,30}$/;

function blogDir(locale: ContentLocale, opts?: ContentOptions): string {
  return path.join(contentRoot(opts), locale, 'blog');
}

function slugsIn(locale: ContentLocale, opts?: ContentOptions): string[] {
  const dir = blogDir(locale, opts);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && SLUG_PATTERN.test(name.slice(0, -3)))
    .map((name) => name.slice(0, -3));
}

/** Reads one article file for exactly this locale; the body of a withdrawn article is never kept. */
function loadFile(slug: string, locale: ContentLocale, fallback: boolean, opts?: ContentOptions): Loaded | null {
  const full = path.join(blogDir(locale, opts), `${slug}.md`);
  if (!existsSync(full)) return null;
  const file = path.join(locale, 'blog', `${slug}.md`);
  const { data, body } = parseFrontMatter(readFileSync(full, 'utf8'));
  const status = requireString(data, 'status', file);
  if (status === 'withdrawn') {
    return { kind: 'withdrawn', slug, topic: requireString(data, 'topic', file) };
  }
  if (status !== 'published') throw new ContentError(`${file}: status must be published or withdrawn`);
  const date = requireString(data, 'date', file);
  if (!DATE_PATTERN.test(date)) throw new ContentError(`${file}: date must be YYYY-MM-DD`);
  const updated = optionalString(data, 'updated');
  if (updated !== undefined && !DATE_PATTERN.test(updated)) throw new ContentError(`${file}: updated must be YYYY-MM-DD`);
  return {
    kind: 'published',
    article: {
      slug,
      title: requireString(data, 'title', file),
      description: requireString(data, 'description', file),
      date,
      updated,
      tags: stringList(data, 'tags'),
      servedLocale: locale,
      fallback,
      html: renderMarkdown(body, locale),
    },
  };
}

/** The article for a locale: its own file, else the en-US file flagged as fallback. */
function load(slug: string, locale: ContentLocale, opts?: ContentOptions): Loaded | null {
  if (!SLUG_PATTERN.test(slug) || !isContentLocale(locale)) return null;
  const own = loadFile(slug, locale, false, opts);
  if (own || locale === FALLBACK_LOCALE) return own;
  return loadFile(slug, FALLBACK_LOCALE, true, opts);
}

function summarise({ html: _html, ...summary }: Article): ArticleSummary {
  void _html;
  return summary;
}

/** Published articles of a locale (slugs from both locales), newest first. Withdrawn articles are never listed. */
function allPublished(locale: ContentLocale, opts?: ContentOptions): ArticleSummary[] {
  const slugs = new Set([...slugsIn(FALLBACK_LOCALE, opts), ...slugsIn(locale, opts)]);
  const out: ArticleSummary[] = [];
  for (const slug of slugs) {
    const loaded = load(slug, locale, opts);
    if (loaded?.kind === 'published') out.push(summarise(loaded.article));
  }
  return out.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
}

/** Sorted unique tags of the unfiltered published set. */
export function listTags(locale: ContentLocale, opts?: ContentOptions): string[] {
  return [...new Set(allPublished(locale, opts).flatMap((a) => a.tags))].sort();
}

/** Published articles, newest first; `tags` filter is AND (an article must carry every tag). */
export function listArticles(
  locale: ContentLocale,
  filter: { tags?: string[] } = {},
  opts?: ContentOptions,
): { articles: ArticleSummary[]; allTags: string[] } {
  const published = allPublished(locale, opts);
  const wanted = (filter.tags ?? []).filter((tag) => TAG_PATTERN.test(tag));
  const articles = published.filter((a) => wanted.every((tag) => a.tags.includes(tag)));
  return { articles, allTags: [...new Set(published.flatMap((a) => a.tags))].sort() };
}

/** `null` for an unknown or unsafe slug. A withdrawn article returns only its topic, never its text. */
export function getArticle(slug: string, locale: ContentLocale, opts?: ContentOptions): ArticleResult {
  const loaded = load(slug, locale, opts);
  if (!loaded) return null;
  return loaded.kind === 'withdrawn' ? loaded : { kind: 'article', article: loaded.article };
}

/** Other published articles sharing at least one tag, newest first. A tagless article has none. */
export function getRelated(article: ArticleSummary, locale: ContentLocale, opts?: ContentOptions, limit = 3): ArticleSummary[] {
  if (article.tags.length === 0) return [];
  return allPublished(locale, opts)
    .filter((other) => other.slug !== article.slug && other.tags.some((tag) => article.tags.includes(tag)))
    .slice(0, limit);
}

/** Parses `?tag=` values: valid slugs only, de-duplicated, at most three. */
export function parseTagFilter(raw: string | string[] | undefined): string[] {
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const seen: string[] = [];
  for (const value of values) {
    if (TAG_PATTERN.test(value) && !seen.includes(value)) seen.push(value);
  }
  return seen.slice(0, 3);
}

/** Locales that have their own file for a slug (drives the hreflang alternates). */
export function availableLocales(slug: string, opts?: ContentOptions): ContentLocale[] {
  if (!SLUG_PATTERN.test(slug)) return [];
  return (['en-US', 'de-DE'] as const).filter((locale) => existsSync(path.join(blogDir(locale, opts), `${slug}.md`)));
}
