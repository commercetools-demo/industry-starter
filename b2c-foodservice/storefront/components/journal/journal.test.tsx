import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ARTICLES } from '@/content/journal';
import { filterArticles, paginate, parseJournalQuery, relatedArticles } from '@/lib/content/journal';
import type { Article } from '@/lib/content/journal-types';
import { renderWithIntl } from '@/test/render';
import JournalView from './JournalView';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const q = (sp: Parameters<typeof parseJournalQuery>[0]) => parseJournalQuery(sp);

describe('Journal listing', () => {
  it('Filter matches nothing: states it and keeps the applied filters visible', () => {
    renderWithIntl(<JournalView locale="en-US" query={q({ tag: ['brewing', 'machines'] })} />);
    expect(screen.getByText('No articles match your filters.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remove filter Brewing' })).toHaveAttribute('href', '/journal?tag=machines');
    expect(screen.getByRole('link', { name: 'Remove filter Machines' })).toHaveAttribute('href', '/journal?tag=brewing');
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', '/journal');
  });

  it('removing one chip relaxes only that filter', () => {
    const before = filterArticles(q({ tag: ['brewing', 'machines'] }), 'en-US');
    const after = filterArticles(q({ tag: ['machines'] }), 'en-US');
    expect(before).toHaveLength(0);
    expect(after.map((a) => a.slug)).toEqual(['descale-your-machine']);
  });

  it('all selected tags must match', () => {
    expect(filterArticles(q({ tag: ['brewing', 'care'] }), 'en-US').map((a) => a.slug)).toEqual(['brew-a-better-cup']);
    expect(filterArticles(q({ tag: ['care'] }), 'en-US').map((a) => a.slug)).toEqual(['brew-a-better-cup', 'descale-your-machine']);
  });

  it('unknown tags are ignored', () => {
    expect(q({ tag: ['nope', 'care'] }).tags).toEqual(['care']);
  });

  it('search matches title and description', () => {
    expect(filterArticles(q({ q: 'DESCALE' }), 'en-US').map((a) => a.slug)).toEqual(['descale-your-machine']);
    expect(filterArticles(q({ q: 'zzz' }), 'en-US')).toHaveLength(0);
    expect(filterArticles(q({ q: 'fresh beans' }), 'en-US').map((a) => a.slug)).toEqual(['brew-a-better-cup']);
  });

  it('page beyond the last is clamped', () => {
    const many = Array.from({ length: 20 }, (_, i) => i);
    expect(paginate(many, 99)).toMatchObject({ page: 3, totalPages: 3 });
    expect(paginate(many, 99).items).toHaveLength(2);
    expect(paginate(many, 0).page).toBe(1);
    expect(q({ page: 'abc' }).page).toBe(1);
  });

  it('withdrawn and unknown articles are not listed', () => {
    renderWithIntl(<JournalView locale="en-US" query={q({})} />);
    expect(screen.queryByText('Our capsule take-back plan')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(filterArticles(q({ tag: ['capsules'] }), 'en-US')).toHaveLength(0);
  });

  it('lists newest first', () => {
    expect(filterArticles(q({}), 'en-US').map((a) => a.slug)).toEqual(['brew-a-better-cup', 'descale-your-machine', 'from-the-roastery']);
  });

  it('fallback articles are marked', () => {
    const { container } = renderWithIntl(<JournalView locale="en-CA" query={q({})} />, { locale: 'en-CA' });
    expect(screen.getByRole('note')).toHaveTextContent('This page is shown in English');
    const card = screen.getAllByRole('article')[0];
    expect(within(card).getByRole('heading', { level: 2 }).getAttribute('lang')).toBe('en');
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('tag chips link to the toggled filter and mark the active one', () => {
    renderWithIntl(<JournalView locale="en-US" query={q({ tag: 'care', q: 'cup' })} />);
    const nav = screen.getByRole('navigation', { name: 'Filter by topic' });
    expect(within(nav).getByRole('link', { name: 'Care' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('link', { name: 'Care' })).toHaveAttribute('href', '/journal?q=cup');
    expect(within(nav).getByRole('link', { name: 'Brewing' })).toHaveAttribute('href', '/journal?tag=care&tag=brewing&q=cup');
  });
});

describe('Journal registry', () => {
  it('article slugs are unique and valid', () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const s of slugs) expect(s.length).toBeGreaterThanOrEqual(3);
  });

  it('content validity: tags in taxonomy, dates valid, descriptions sized, withdrawn have no text', () => {
    for (const a of ARTICLES) {
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (a.status === 'published') {
        for (const d of Object.values(a.description)) {
          expect(d.length, a.slug).toBeGreaterThanOrEqual(110);
          expect(d.length, a.slug).toBeLessThanOrEqual(160);
        }
        expect(a.body['en-US'].length).toBeGreaterThan(0);
      } else {
        expect(a.body['en-US']).toEqual([]);
      }
      if (a.image) expect(a.image.url).not.toMatch(/[?#]/);
    }
  });

  it('related shows at most three published articles sharing a tag', () => {
    const mk = (slug: string, tags: Article['tags'], status: Article['status'] = 'published', publishedAt = '2026-01-01'): Article => ({
      slug, status, tags, topicTag: 'care', publishedAt, title: { 'en-US': slug }, description: { 'en-US': slug }, body: { 'en-US': [] },
    });
    const all = [mk('a', ['care']), mk('b', ['care'], 'published', '2026-02-01'), mk('c', ['care', 'brewing'], 'published', '2026-03-01'), mk('d', ['care'], 'withdrawn'), mk('e', ['care'], 'published', '2026-04-01'), mk('f', ['sourcing'])];
    expect(relatedArticles(all[0], all).map((x) => x.slug)).toEqual(['e', 'c', 'b']);
  });

  it('Article without tags: related block is omitted', () => {
    const untagged = ARTICLES.find((a) => a.slug === 'from-the-roastery')!;
    expect(relatedArticles(untagged)).toEqual([]);
  });
});
