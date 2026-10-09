// File-based content (workstream V): Markdown with front matter under site/content/, read at build or
// request time on the server. No commercetools import: these pages must survive a degraded commerce tier.
//
// Layout: content/<collection>/<name>.md is the default-locale (en-US) text; a translation sits next to
// it as <name>.<locale>.md. A missing translation falls back to the default text and says so (`fellBack`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

export type MetaValue = string | number | boolean | string[];
export type Meta = Record<string, MetaValue>;

export interface ContentDoc {
  /** File base name without locale or extension. */
  name: string;
  meta: Meta;
  body: string;
  /** Locale of the text actually returned. */
  locale: string;
  /** True when the requested locale had no translation and the default-locale text is shown. */
  fellBack: boolean;
}

// The content folder is traced into the deployment by `outputFileTracingIncludes` in next.config.ts, so the
// bundler is told not to trace the whole project from this dynamic path.
export const CONTENT_ROOT = join(/* turbopackIgnore: true */ process.cwd(), 'content');

function unquote(value: string): string {
  const m = /^(["'])(.*)\1$/.exec(value);
  return m ? (m[2] ?? '') : value;
}

function parseValue(raw: string): MetaValue {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((part) => unquote(part.trim()))
      .filter((part) => part !== '');
  }
  return unquote(value);
}

/** `---` delimited `key: value` lines (strings, numbers, booleans, `[a, b]` lists), then the body. */
export function parseFrontMatter(raw: string): { meta: Meta; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!match) return { meta: {}, body: text.trim() };
  const meta: Meta = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (pair?.[1]) meta[pair[1]] = parseValue(pair[2] ?? '');
  }
  return { meta, body: text.slice(match[0].length).trim() };
}

const TRANSLATED = /^(.+)\.([a-z]{2,3}-[A-Za-z]{2,4})\.md$/;

/** Base names of a collection (translations collapsed), sorted. Empty when the folder is missing. */
export function listNames(collection: string, root: string = CONTENT_ROOT): string[] {
  const dir = join(root, collection);
  if (!existsSync(dir)) return [];
  const names = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    names.add(TRANSLATED.exec(entry.name)?.[1] ?? entry.name.slice(0, -'.md'.length));
  }
  return [...names].sort();
}

function readFile(path: string): { meta: Meta; body: string } | null {
  return existsSync(path) ? parseFrontMatter(readFileSync(path, 'utf8')) : null;
}

/** Reads one document: the requested locale first, then the default locale (flagged `fellBack`). */
export function readDoc(collection: string, name: string, locale: string, root: string = CONTENT_ROOT): ContentDoc | null {
  // Names come from the folder listing or from validated slugs; refuse anything that could leave it.
  if (!/^[\w-]+$/.test(name) || collection.split('/').some((part) => part === '..' || part === '')) return null;
  const dir = join(root, collection);
  const wanted =
    locale !== DEFAULT_LOCALE && /^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(locale) ? readFile(join(dir, `${name}.${locale}.md`)) : null;
  if (wanted) return { name, ...wanted, locale, fellBack: false };
  const fallback = readFile(join(dir, `${name}.md`));
  return fallback ? { name, ...fallback, locale: DEFAULT_LOCALE, fellBack: locale !== DEFAULT_LOCALE } : null;
}

export function listDocs(collection: string, locale: string, root: string = CONTENT_ROOT): ContentDoc[] {
  return listNames(collection, root).flatMap((name) => readDoc(collection, name, locale, root) ?? []);
}

const str = (value: MetaValue | undefined): string => (typeof value === 'string' ? value : '');
const num = (value: MetaValue | undefined, fallback = 0): number => (typeof value === 'number' ? value : fallback);
const list = (value: MetaValue | undefined): string[] => (Array.isArray(value) ? value : []);

// ---------------------------------------------------------------------------------------------------
// Policies

export const POLICY_SLUGS = ['shipping-and-returns', 'terms', 'privacy'] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export function isPolicySlug(value: string): value is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(value);
}

export interface Policy {
  slug: PolicySlug;
  title: string;
  /** ISO date (yyyy-mm-dd) the shown text took effect. */
  effective: string;
  body: string;
  draft: boolean;
  fellBack: boolean;
  /** True when an older version was requested with ?version= (a newer one is in force). */
  superseded: boolean;
  /** Effective date of the version in force. */
  currentEffective: string;
  /** Every version in force on or before today, newest first. */
  versions: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * The policy text for a slug. Without `version` the newest version whose effective date is not in the
 * future is served; with `version` that exact (superseded) version, or null when it does not exist.
 */
export function getPolicy(
  slug: string,
  locale: string,
  options: { version?: string; today?: string; root?: string } = {},
): Policy | null {
  if (!isPolicySlug(slug)) return null;
  const { root = CONTENT_ROOT, today = todayIso(), version } = options;
  const collection = `policies/${slug}`;
  const dates = listNames(collection, root)
    .filter((name) => ISO_DATE.test(name) && name <= today)
    .sort()
    .reverse();
  const current = dates[0];
  if (!current) return null;
  const wanted = version === undefined ? current : version;
  if (!dates.includes(wanted)) return null;
  const doc = readDoc(collection, wanted, locale, root);
  if (!doc) return null;
  return {
    slug,
    title: str(doc.meta.title),
    effective: str(doc.meta.effective) || wanted,
    body: doc.body,
    draft: doc.meta.draft === true,
    fellBack: doc.fellBack,
    superseded: wanted !== current,
    currentEffective: current,
    versions: dates,
  };
}

// ---------------------------------------------------------------------------------------------------
// FAQ

export const FAQ_TOPICS = ['booking', 'prescriptions-delivery', 'lab-results', 'account-privacy'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

export interface FaqItem {
  id: string;
  question: string;
  body: string;
  draft: boolean;
  fellBack: boolean;
}
export interface FaqGroup {
  topic: FaqTopic;
  items: FaqItem[];
}

/** Published questions grouped under the fixed topic order; topics without questions are omitted. */
export function getFaqGroups(locale: string, root: string = CONTENT_ROOT): FaqGroup[] {
  const docs = listDocs('faq', locale, root);
  return FAQ_TOPICS.flatMap((topic) => {
    const items = docs
      .filter((doc) => doc.meta.topic === topic && str(doc.meta.question) !== '' && doc.body !== '')
      .sort((a, b) => num(a.meta.order) - num(b.meta.order) || a.name.localeCompare(b.name))
      .map((doc) => ({
        id: doc.name,
        question: str(doc.meta.question),
        body: doc.body,
        draft: doc.meta.draft === true,
        fellBack: doc.fellBack,
      }));
    return items.length > 0 ? [{ topic, items }] : [];
  });
}

// ---------------------------------------------------------------------------------------------------
// About and contact

export interface PageDoc {
  title: string;
  description: string;
  body: string;
  draft: boolean;
  fellBack: boolean;
}

function pageDoc(doc: ContentDoc | null): PageDoc | null {
  return doc
    ? {
        title: str(doc.meta.title),
        description: str(doc.meta.description),
        body: doc.body,
        draft: doc.meta.draft === true,
        fellBack: doc.fellBack,
      }
    : null;
}

export const getAbout = (locale: string, root: string = CONTENT_ROOT): PageDoc | null =>
  pageDoc(readDoc('about', 'index', locale, root));

export interface Office extends PageDoc {
  country: string;
}

export interface ContactContent {
  general: PageDoc | null;
  /** Offices serving the country; empty when none is listed (the page then shows the general block only). */
  offices: Office[];
}

export function getContact(locale: string, country?: string, root: string = CONTENT_ROOT): ContactContent {
  const code = country ?? (isSupportedLocale(locale) ? COUNTRY_CONFIG[locale].country : '');
  const offices = listDocs('contact/offices', locale, root)
    .filter((doc) => str(doc.meta.country) === code)
    .flatMap((doc) => {
      const page = pageDoc(doc);
      return page ? [{ ...page, country: code }] : [];
    });
  return { general: pageDoc(readDoc('contact', 'general', locale, root)), offices };
}

// ---------------------------------------------------------------------------------------------------
// Journal

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  minutes: number;
  /** ISO publication date. */
  published: string;
  tags: string[];
  withdrawn: boolean;
  /** Empty for a withdrawn article: the withdrawn text is never served. */
  body: string;
  draft: boolean;
  fellBack: boolean;
}

export function getArticles(locale: string, root: string = CONTENT_ROOT): Article[] {
  return listDocs('journal', locale, root)
    .map((doc): Article => {
      const withdrawn = doc.meta.withdrawn === true;
      return {
        slug: doc.name,
        title: str(doc.meta.title),
        description: str(doc.meta.description),
        category: str(doc.meta.category),
        minutes: num(doc.meta.minutes, 1),
        published: str(doc.meta.published),
        tags: list(doc.meta.tags),
        withdrawn,
        body: withdrawn ? '' : doc.body,
        draft: doc.meta.draft === true,
        fellBack: doc.fellBack,
      };
    })
    .sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
}

export const getPublishedArticles = (locale: string, root?: string): Article[] =>
  getArticles(locale, root).filter((article) => !article.withdrawn);

export const getArticle = (slug: string, locale: string, root?: string): Article | null =>
  getArticles(locale, root).find((article) => article.slug === slug) ?? null;

/** Published articles sharing a tag; empty for an article without tags (the block is then omitted). */
export function getRelatedArticles(article: Article, locale: string, root?: string): Article[] {
  if (article.tags.length === 0) return [];
  return getPublishedArticles(locale, root)
    .filter((other) => other.slug !== article.slug && other.tags.some((tag) => article.tags.includes(tag)))
    .slice(0, 3);
}

export const categoriesOf = (articles: readonly Article[]): string[] =>
  [...new Set(articles.map((a) => a.category))].filter(Boolean).sort();

/** The home journal row (M-07) and the header link need at least this many published articles. */
export const JOURNAL_ROW_MIN = 3;
export const hasJournalRow = (locale: string, root?: string): boolean =>
  getPublishedArticles(locale, root).length >= JOURNAL_ROW_MIN;
