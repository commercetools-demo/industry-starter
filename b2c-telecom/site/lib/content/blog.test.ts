// @vitest-environment node
import { makeContentRoot, removeContentRoots } from '@/test/content-fixtures';
import { getArticle, getRelated, listArticles, listTags, parseTagFilter } from './blog';
import { ContentError } from './types';

afterEach(removeContentRoots);

function article(title: string, date: string, tags: string[], body = 'Body text', extra = ''): string {
  return `---\ntitle: ${title}\ndescription: ${title} d\ndate: ${date}\nstatus: published\ntags: [${tags.join(', ')}]\n${extra}---\n${body}\n`;
}

const FILES = {
  'en-US/blog/alpha.md': article('Alpha', '2026-01-10', ['internet', 'labels']),
  'en-US/blog/beta.md': article('Beta', '2026-03-01', ['pricing', 'internet']),
  'en-US/blog/gamma.md': article('Gamma', '2026-02-01', ['phone']),
  'en-US/blog/lonely.md': article('Lonely', '2026-04-01', []),
  'en-US/blog/gone.md': `---\ntitle: Gone\ndescription: d\ndate: 2026-05-01\nstatus: withdrawn\ntopic: pricing\ntags: [pricing]\n---\nSECRET-WITHDRAWN-TEXT\n`,
};

describe('listArticles', () => {
  it('lists published articles newest first and never the withdrawn one', () => {
    const { articles } = listArticles('en-US', {}, { root: makeContentRoot(FILES) });
    expect(articles.map((a) => a.slug)).toEqual(['lonely', 'beta', 'gamma', 'alpha']);
    expect(articles[0]).not.toHaveProperty('html');
  });

  it('filters tags with AND semantics', () => {
    const root = makeContentRoot(FILES);
    expect(listArticles('en-US', { tags: ['internet'] }, { root }).articles.map((a) => a.slug)).toEqual(['beta', 'alpha']);
    expect(listArticles('en-US', { tags: ['internet', 'labels'] }, { root }).articles.map((a) => a.slug)).toEqual(['alpha']);
    expect(listArticles('en-US', { tags: ['phone', 'labels'] }, { root }).articles).toEqual([]);
  });

  it('allTags is the sorted unique set of the unfiltered published articles', () => {
    const { allTags } = listArticles('en-US', { tags: ['phone'] }, { root: makeContentRoot(FILES) });
    expect(allTags).toEqual(['internet', 'labels', 'phone', 'pricing']);
    expect(listTags('en-US', { root: makeContentRoot(FILES) })).toEqual(allTags);
  });

  it('de-DE is the union of both locales with the German file preferred and the fallback flagged', () => {
    const root = makeContentRoot({ ...FILES, 'de-DE/blog/alpha.md': article('Alpha DE', '2026-01-10', ['internet', 'labels']) });
    const { articles } = listArticles('de-DE', {}, { root });
    expect(articles.map((a) => [a.slug, a.title, a.fallback, a.servedLocale])).toEqual([
      ['lonely', 'Lonely', true, 'en-US'],
      ['beta', 'Beta', true, 'en-US'],
      ['gamma', 'Gamma', true, 'en-US'],
      ['alpha', 'Alpha DE', false, 'de-DE'],
    ]);
  });
});

describe('getArticle', () => {
  it('returns the article with rendered html', () => {
    const result = getArticle('alpha', 'en-US', { root: makeContentRoot(FILES) });
    expect(result).toMatchObject({ kind: 'article', article: { slug: 'alpha', title: 'Alpha', tags: ['internet', 'labels'], fallback: false } });
    expect(result?.kind === 'article' && result.article.html).toContain('Body text');
  });

  it('Article withdrawn: the body is never returned, only the topic', () => {
    const result = getArticle('gone', 'en-US', { root: makeContentRoot(FILES) });
    expect(result).toEqual({ kind: 'withdrawn', slug: 'gone', topic: 'pricing' });
    expect(JSON.stringify(result)).not.toContain('SECRET-WITHDRAWN-TEXT');
  });

  it('a withdrawn article without a topic is a ContentError', () => {
    const root = makeContentRoot({ 'en-US/blog/gone.md': '---\ntitle: G\ndescription: d\ndate: 2026-05-01\nstatus: withdrawn\n---\nx' });
    expect(() => getArticle('gone', 'en-US', { root })).toThrow(ContentError);
  });

  it('missing slug is null and unsafe slugs are rejected', () => {
    const root = makeContentRoot(FILES);
    expect(getArticle('nope', 'en-US', { root })).toBeNull();
    for (const slug of ['../alpha', 'Alpha', 'a/b', 'alpha.md', '']) expect(getArticle(slug, 'en-US', { root })).toBeNull();
  });

  it('de-DE falls back to the English file and flags it', () => {
    const result = getArticle('alpha', 'de-DE', { root: makeContentRoot(FILES) });
    expect(result).toMatchObject({ kind: 'article', article: { fallback: true, servedLocale: 'en-US' } });
  });

  it('rejects an invalid date or status', () => {
    expect(() => getArticle('a', 'en-US', { root: makeContentRoot({ 'en-US/blog/a.md': article('A', '01.02.2026', []) }) })).toThrow('date must be YYYY-MM-DD');
    expect(() => getArticle('a', 'en-US', { root: makeContentRoot({ 'en-US/blog/a.md': article('A', '2026-01-01', []).replace('published', 'draft') }) })).toThrow('status');
  });
});

describe('getRelated', () => {
  it('returns other published articles sharing a tag, newest first, max three', () => {
    const root = makeContentRoot({
      ...FILES,
      'en-US/blog/delta.md': article('Delta', '2026-06-01', ['internet']),
      'en-US/blog/eps.md': article('Eps', '2026-06-02', ['internet']),
    });
    const alpha = listArticles('en-US', {}, { root }).articles.find((a) => a.slug === 'alpha')!;
    expect(getRelated(alpha, 'en-US', { root }).map((a) => a.slug)).toEqual(['eps', 'delta', 'beta']);
    expect(getRelated(alpha, 'en-US', { root }, 1)).toHaveLength(1);
  });

  it('Article without tags: no related articles', () => {
    const root = makeContentRoot(FILES);
    const lonely = listArticles('en-US', {}, { root }).articles.find((a) => a.slug === 'lonely')!;
    expect(lonely.tags).toEqual([]);
    expect(getRelated(lonely, 'en-US', { root })).toEqual([]);
  });

  it('never includes the article itself or a withdrawn one', () => {
    const root = makeContentRoot(FILES);
    const beta = listArticles('en-US', {}, { root }).articles.find((a) => a.slug === 'beta')!;
    expect(getRelated(beta, 'en-US', { root }).map((a) => a.slug)).toEqual(['alpha']);
  });
});

describe('parseTagFilter', () => {
  it('keeps valid distinct slugs, at most three', () => {
    expect(parseTagFilter(['a', 'b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(parseTagFilter('pricing')).toEqual(['pricing']);
    expect(parseTagFilter(undefined)).toEqual([]);
    expect(parseTagFilter(['Bad Tag', '../x', 'x'.repeat(31), 'ok'])).toEqual(['ok']);
  });
});
