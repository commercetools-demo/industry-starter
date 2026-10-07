import { optionalString, parseFrontMatter, requireString } from './frontmatter';
import { readLocaleFile } from './files';
import { renderMarkdown } from './markdown';
import { SLUG_PATTERN, isContentLocale, type ContentLocale, type ContentOptions } from './types';

export type PageSlug = 'about' | 'faq' | 'support';

export interface PageDoc {
  slug: string;
  title: string;
  description: string;
  kicker?: string;
  html: string;
  servedLocale: ContentLocale;
  fallback: boolean;
}

/** Loads a static page; slug and locale are validated so request input can never walk the file system. */
export function getPage(slug: PageSlug, locale: ContentLocale, opts?: ContentOptions): PageDoc | null {
  if (!SLUG_PATTERN.test(slug) || !isContentLocale(locale)) return null;
  const found = readLocaleFile(locale, `${slug}.md`, opts);
  if (!found) return null;
  const { data, body } = parseFrontMatter(found.raw);
  return {
    slug,
    title: requireString(data, 'title', found.file),
    description: requireString(data, 'description', found.file),
    kicker: optionalString(data, 'kicker'),
    html: renderMarkdown(body, found.servedLocale),
    servedLocale: found.servedLocale,
    fallback: found.fallback,
  };
}
