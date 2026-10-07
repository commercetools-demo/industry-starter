import path from 'node:path';

export type ContentLocale = 'en-US' | 'de-DE';

export const FALLBACK_LOCALE: ContentLocale = 'en-US';

export interface ContentOptions {
  /** Directory holding `<locale>/...` content; defaults to `<cwd>/content`. Tests pass a temporary directory. */
  root?: string;
  /** Clock for "which policy version is in force today". */
  now?: Date;
}

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

export function contentRoot(opts?: ContentOptions): string {
  return opts?.root ?? path.join(process.cwd(), 'content');
}

export function isContentLocale(value: unknown): value is ContentLocale {
  return value === 'en-US' || value === 'de-DE';
}

/** Slugs and policy names become file names: lowercase letters, digits and hyphens only (no path traversal). */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
