import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { contentRoot, FALLBACK_LOCALE, type ContentLocale, type ContentOptions } from './types';

export interface LocaleFile {
  raw: string;
  /** Path relative to the content root, for error messages. */
  file: string;
  servedLocale: ContentLocale;
  fallback: boolean;
}

function read(locale: ContentLocale, relative: string, opts?: ContentOptions): { raw: string; file: string } | null {
  const file = path.join(locale, relative);
  const full = path.join(contentRoot(opts), file);
  if (!existsSync(full)) return null;
  return { raw: readFileSync(full, 'utf8'), file };
}

/**
 * Reads `<root>/<locale>/<relative>`; a locale without the file gets the en-US file with `fallback: true`.
 * `relative` must be built from validated slugs by the caller (never from raw request input).
 */
export function readLocaleFile(locale: ContentLocale, relative: string, opts?: ContentOptions): LocaleFile | null {
  const own = read(locale, relative, opts);
  if (own) return { ...own, servedLocale: locale, fallback: false };
  if (locale === FALLBACK_LOCALE) return null;
  const english = read(FALLBACK_LOCALE, relative, opts);
  return english ? { ...english, servedLocale: FALLBACK_LOCALE, fallback: true } : null;
}
