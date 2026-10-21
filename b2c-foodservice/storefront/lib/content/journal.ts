import { ARTICLES } from '@/content/journal';
import { resolveLocalized } from '@/lib/content/localized';
import { JOURNAL_TAGS, type Article, type JournalTag } from '@/lib/content/journal-types';

export const PER_PAGE = 9;
export const MAX_RELATED = 3;

export interface JournalQuery {
  tags: JournalTag[];
  q: string;
  page: number;
}

export function isJournalTag(value: string): value is JournalTag {
  return (JOURNAL_TAGS as readonly string[]).includes(value);
}

function many(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** Reads `?tag=` (repeatable), `?q=` and `?page=`. Unknown tags are ignored; page is at least 1. */
export function parseJournalQuery(sp: { tag?: string | string[]; q?: string | string[]; page?: string | string[] }): JournalQuery {
  const tags = [...new Set(many(sp.tag).filter(isJournalTag))];
  const q = (many(sp.q)[0] ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(many(sp.page)[0] ?? '1', 10) || 1);
  return { tags, q, page };
}

export function getArticle(slug: string, articles: Article[] = ARTICLES): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function publishedArticles(articles: Article[] = ARTICLES): Article[] {
  return articles.filter((a) => a.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Published articles, newest first. Every selected tag must match; `q` matches title and description, case-insensitively. */
export function filterArticles(
  query: Pick<JournalQuery, 'tags' | 'q'>,
  locale: string,
  articles: Article[] = ARTICLES,
): Article[] {
  const needle = query.q.toLowerCase();
  return publishedArticles(articles).filter((a) => {
    if (!query.tags.every((t) => a.tags.includes(t))) return false;
    if (!needle) return true;
    const title = resolveLocalized(a.title, locale).value.toLowerCase();
    const description = resolveLocalized(a.description, locale).value.toLowerCase();
    return title.includes(needle) || description.includes(needle);
  });
}

export function paginate<T>(items: T[], page: number, perPage = PER_PAGE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const clamped = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((clamped - 1) * perPage, clamped * perPage), page: clamped, totalPages };
}

/** Other published articles sharing at least one tag, newest first, at most three. Never padded with unrelated ones. */
export function relatedArticles(article: Article, articles: Article[] = ARTICLES): Article[] {
  if (article.tags.length === 0) return [];
  return publishedArticles(articles)
    .filter((a) => a.slug !== article.slug && a.tags.some((t) => article.tags.includes(t)))
    .slice(0, MAX_RELATED);
}

/** Locales that have their own text for an article (title and body). */
export function ownLocalesOf(article: Article, locales: readonly string[]): string[] {
  return locales.filter((l) => !resolveLocalized(article.title, l).isFallback && !resolveLocalized(article.body, l).isFallback);
}
