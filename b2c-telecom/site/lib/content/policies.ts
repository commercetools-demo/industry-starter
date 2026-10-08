import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFrontMatter, requireString } from './frontmatter';
import { renderMarkdown } from './markdown';
import { LEGAL_SLUGS, isLegalSlug, legalPath, type LegalSlug } from './legal-slugs';
import { ContentError, DATE_PATTERN, FALLBACK_LOCALE, contentRoot, type ContentLocale, type ContentOptions } from './types';

export { LEGAL_SLUGS, isLegalSlug, legalPath, type LegalSlug };

export interface PolicyDoc {
  policy: LegalSlug;
  title: string;
  description: string;
  html: string;
  /** `YYYY-MM-DD` of the version shown. */
  effective: string;
  servedLocale: ContentLocale;
  fallback: boolean;
  /** True only when `asOf` selected an older version. */
  superseded: boolean;
  /** Effective date of the version that replaced the one shown. */
  supersededOn?: string;
  /** Effective date of the version in force today. */
  currentEffective: string;
  /** Effective dates of all versions older than `effective`, newest first. */
  earlier: string[];
}

interface VersionSet {
  dates: string[];
  locale: ContentLocale;
  fallback: boolean;
}

function datesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && DATE_PATTERN.test(name.slice(0, -3)))
    .map((name) => name.slice(0, -3))
    .sort()
    .reverse();
}

/** All version dates (newest first) a locale has; a locale with none uses the whole en-US set. */
function versionSet(policy: LegalSlug, locale: ContentLocale, opts?: ContentOptions): VersionSet {
  const base = (l: ContentLocale) => path.join(contentRoot(opts), l, 'legal', policy);
  const own = datesIn(base(locale));
  if (own.length > 0 || locale === FALLBACK_LOCALE) return { dates: own, locale, fallback: false };
  return { dates: datesIn(base(FALLBACK_LOCALE)), locale: FALLBACK_LOCALE, fallback: true };
}

/** Effective dates of every version file for the locale (including future-dated ones), newest first. */
export function listVersions(policy: LegalSlug, locale: ContentLocale, opts?: ContentOptions): string[] {
  return versionSet(policy, locale, opts).dates;
}

function todayUtc(opts?: ContentOptions): string {
  return (opts?.now ?? new Date()).toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * The version of a policy in force on `asOf` (default today): the file with the largest effective date not after that day.
 * Dates compare as `YYYY-MM-DD` strings in UTC. A file dated in the future stays invisible until its date, and `asOf`
 * is capped at today so a future date cannot reveal an unpublished version. An invalid `asOf` is ignored.
 */
export function getPolicy(policy: string, locale: ContentLocale, opts?: ContentOptions & { asOf?: string }): PolicyDoc | null {
  if (!isLegalSlug(policy)) return null;
  const today = todayUtc(opts);
  const asOf = opts?.asOf && isRealDate(opts.asOf) ? opts.asOf : undefined;
  const reference = asOf && asOf < today ? asOf : today;

  const set = versionSet(policy, locale, opts);
  const published = set.dates.filter((date) => date <= today); // newest first
  const chosen = published.find((date) => date <= reference);
  if (!chosen) return null;
  const currentEffective = published[0];

  const file = path.join(set.locale, 'legal', policy, `${chosen}.md`);
  const { data, body } = parseFrontMatter(readFileSync(path.join(contentRoot(opts), file), 'utf8'));
  const effective = requireString(data, 'effective', file);
  if (effective !== chosen) throw new ContentError(`${file}: effective ${effective} must equal the file name`);

  const superseded = chosen < currentEffective;
  const supersededOn = superseded ? [...published].reverse().find((date) => date > chosen) : undefined;
  return {
    policy,
    title: requireString(data, 'title', file),
    description: requireString(data, 'description', file),
    html: renderMarkdown(body, set.locale),
    effective,
    servedLocale: set.locale,
    fallback: set.fallback,
    superseded,
    supersededOn,
    currentEffective,
    earlier: published.filter((date) => date < chosen),
  };
}
