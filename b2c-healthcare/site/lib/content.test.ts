// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getArticle,
  getArticles,
  getContact,
  getFaqGroups,
  getPolicy,
  getPublishedArticles,
  getRelatedArticles,
  hasJournalRow,
  listNames,
  parseFrontMatter,
  readDoc,
} from './content';

let root = '';
function put(path: string, text: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'content-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('lib/content: front matter', () => {
  it('parses strings, numbers, booleans and lists, then the body', () => {
    const { meta, body } = parseFrontMatter('---\ntitle: "Hello: world"\nminutes: 4\nwithdrawn: true\ntags: [a, "b c"]\n---\nBody text\n');
    expect(meta).toEqual({ title: 'Hello: world', minutes: 4, withdrawn: true, tags: ['a', 'b c'] });
    expect(body).toBe('Body text');
  });
  it('a file without front matter is all body; CRLF is accepted', () => {
    expect(parseFrontMatter('Just text')).toEqual({ meta: {}, body: 'Just text' });
    expect(parseFrontMatter('---\r\nk: v\r\n---\r\nB').meta).toEqual({ k: 'v' });
  });
});

describe('lib/content: locale fallback', () => {
  it('serves the translation when present and falls back to the default text, flagged', () => {
    put('about/index.md', '---\ntitle: English\n---\nEN');
    put('about/index.fr-FR.md', '---\ntitle: Francais\n---\nFR');
    expect(readDoc('about', 'index', 'fr-FR', root)).toMatchObject({ body: 'FR', locale: 'fr-FR', fellBack: false });
    expect(readDoc('about', 'index', 'de-DE', root)).toMatchObject({ body: 'EN', locale: 'en-US', fellBack: true });
    expect(readDoc('about', 'index', 'en-US', root)).toMatchObject({ fellBack: false });
  });
  it('list names collapse translations; missing folder is empty; unsafe names are refused', () => {
    put('faq/a.md', 'x');
    put('faq/a.fr-FR.md', 'x');
    put('faq/b.md', 'x');
    expect(listNames('faq', root)).toEqual(['a', 'b']);
    expect(listNames('nope', root)).toEqual([]);
    expect(readDoc('faq', '../secret', 'en-US', root)).toBeNull();
  });
});

describe('policy-pages › Version superseded (loader)', () => {
  beforeEach(() => {
    put('policies/terms/2025-01-01.md', '---\ntitle: Terms\neffective: 2025-01-01\n---\nOld');
    put('policies/terms/2026-02-01.md', '---\ntitle: Terms\neffective: 2026-02-01\n---\nNew');
    put('policies/terms/2099-01-01.md', '---\ntitle: Terms\neffective: 2099-01-01\n---\nFuture');
  });
  it('serves the newest version in force with its own date; future versions are not served', () => {
    const policy = getPolicy('terms', 'en-US', { root, today: '2026-06-01' });
    expect(policy).toMatchObject({ body: 'New', effective: '2026-02-01', superseded: false, versions: ['2026-02-01', '2025-01-01'] });
  });
  it('the date moves with the text when a newer version takes effect', () => {
    expect(getPolicy('terms', 'en-US', { root, today: '2025-06-01' })?.effective).toBe('2025-01-01');
    expect(getPolicy('terms', 'en-US', { root, today: '2099-01-02' })?.effective).toBe('2099-01-01');
  });
  it('an older version is reachable by date and marked superseded; unknown version and slug are null', () => {
    expect(getPolicy('terms', 'en-US', { root, today: '2026-06-01', version: '2025-01-01' })).toMatchObject({
      body: 'Old',
      superseded: true,
      currentEffective: '2026-02-01',
    });
    expect(getPolicy('terms', 'en-US', { root, today: '2026-06-01', version: '2024-01-01' })).toBeNull();
    expect(getPolicy('terms', 'en-US', { root, today: '2026-06-01', version: '../x' })).toBeNull();
    expect(getPolicy('unknown', 'en-US', { root })).toBeNull();
  });
  it('Policy not translated (loader): the default text is served and flagged', () => {
    expect(getPolicy('terms', 'fr-FR', { root, today: '2026-06-01' })).toMatchObject({ body: 'New', fellBack: true });
  });
});

describe('faq loader', () => {
  it('groups by topic in the fixed order, sorts by order and omits empty topics and bodiless items', () => {
    put('faq/b.md', '---\ntopic: lab-results\norder: 2\nquestion: B?\n---\nAnswer B');
    put('faq/a.md', '---\ntopic: booking\norder: 1\nquestion: A?\n---\nAnswer A');
    put('faq/c.md', '---\ntopic: lab-results\norder: 1\nquestion: C?\n---\nAnswer C');
    put('faq/d.md', '---\ntopic: booking\norder: 2\nquestion: D?\n---\n');
    const groups = getFaqGroups('en-US', root);
    expect(groups.map((g) => g.topic)).toEqual(['booking', 'lab-results']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(groups[0]?.items).toHaveLength(1);
  });
});

describe('contact loader', () => {
  it('lists offices for the visitor country only, and none for a region without an office', () => {
    put('contact/general.md', '---\ntitle: Contact\n---\nEmail');
    put('contact/offices/ny.md', '---\ntitle: NY\ncountry: US\n---\nAddr');
    expect(getContact('en-US', undefined, root).offices.map((o) => o.title)).toEqual(['NY']);
    const nowhere = getContact('en-US', 'FR', root);
    expect(nowhere.offices).toEqual([]);
    expect(nowhere.general?.body).toBe('Email');
  });
});

describe('journal loader', () => {
  beforeEach(() => {
    put('journal/a.md', '---\ntitle: A\ncategory: Care\npublished: 2026-03-01\ntags: [x]\n---\nBody A');
    put('journal/b.md', '---\ntitle: B\ncategory: Care\npublished: 2026-04-01\ntags: [x, y]\n---\nBody B');
    put('journal/c.md', '---\ntitle: C\ncategory: Labs\npublished: 2026-02-01\n---\nBody C');
    put('journal/gone.md', '---\ntitle: Gone\ncategory: Care\npublished: 2026-01-01\nwithdrawn: true\ntags: [x]\n---\nSecret text');
  });
  it('newest first; a withdrawn article has no body and is not published', () => {
    expect(getArticles('en-US', root).map((a) => a.slug)).toEqual(['b', 'a', 'c', 'gone']);
    expect(getArticle('gone', 'en-US', root)).toMatchObject({ withdrawn: true, body: '' });
    expect(getPublishedArticles('en-US', root).map((a) => a.slug)).toEqual(['b', 'a', 'c']);
  });
  it('related articles share a tag; an article without tags has none', () => {
    const a = getArticle('a', 'en-US', root)!;
    expect(getRelatedArticles(a, 'en-US', root).map((r) => r.slug)).toEqual(['b']);
    expect(getRelatedArticles(getArticle('c', 'en-US', root)!, 'en-US', root)).toEqual([]);
  });
  it('the home journal row needs three published articles', () => {
    expect(hasJournalRow('en-US', root)).toBe(true);
    rmSync(join(root, 'journal/c.md'));
    expect(hasJournalRow('en-US', root)).toBe(false);
  });
});

describe('the repository content', () => {
  it('has the three policies, FAQ topics, three published articles and an about page', () => {
    for (const slug of ['shipping-and-returns', 'terms', 'privacy']) expect(getPolicy(slug, 'en-US')?.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getFaqGroups('en-US').map((g) => g.topic)).toEqual(['booking', 'prescriptions-delivery', 'lab-results', 'account-privacy']);
    expect(getPublishedArticles('en-US')).toHaveLength(3);
    expect(hasJournalRow('en-US')).toBe(true);
  });
});
