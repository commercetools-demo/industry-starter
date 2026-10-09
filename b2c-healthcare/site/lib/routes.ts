// Route manifest for the static content pages. Locale-less paths; the footer, the
// sitemap and the route test all read from here so a page cannot be linked before it exists.
import { POLICY_SLUGS, getPublishedArticles, hasJournalRow } from '@/lib/content';

export const POLICY_PATHS = POLICY_SLUGS.map((slug) => `/policies/${slug}`);

/** Static pages that always exist (the journal is added when it has articles). */
export const STATIC_PAGE_PATHS = ['/about', '/contact', '/faq', ...POLICY_PATHS] as const;

export const JOURNAL_PATH = '/journal';

export interface SitemapEntry {
  /** Locale-less path. */
  path: string;
  /** ISO date of the last content change, when known. */
  lastModified?: string;
}

/** Everything indexable that this workstream owns: static pages, the journal and each published article. */
export function contentSitemapEntries(locale: string): SitemapEntry[] {
  const articles = getPublishedArticles(locale);
  return [
    ...STATIC_PAGE_PATHS.map((path) => ({ path })),
    ...(articles.length > 0 ? [{ path: JOURNAL_PATH }] : []),
    ...articles.map((article) => ({
      path: `${JOURNAL_PATH}/${article.slug}`,
      ...(article.published ? { lastModified: article.published } : {}),
    })),
  ];
}

/** Whether the header "Health journal" link and the home journal row should show. */
export const showJournal = (locale: string): boolean => hasJournalRow(locale);
