// Pure review validation shared by the form and the route handlers (workstream M, 3.5). No server-only imports.

export const TITLE_MAX = 80;
export const TEXT_MAX = 2000;
export const REVIEW_PAGE_SIZE = 5;

export type ReviewFieldCode = 'rating_required' | 'rating_invalid' | 'title_too_long' | 'text_too_long';

export interface ValidReview { rating: 1 | 2 | 3 | 4 | 5; title?: string; text?: string }
export type ValidationResult =
  | { ok: true; value: ValidReview }
  | { ok: false; fields: Partial<Record<'rating' | 'title' | 'text', ReviewFieldCode>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export const isProductId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/**
 * Removes control characters except newline and tab, normalises line endings, collapses three or more blank lines to
 * two and trims. Markup is kept as typed: React renders it as text (no dangerouslySetInnerHTML anywhere).
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_EXCEPT_NEWLINE_TAB, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Counts characters like the user sees them (code points), so emoji do not count twice. */
const length = (s: string): number => [...s].length;

export function validateReviewInput(input: unknown, opts: { partial?: boolean } = {}): ValidationResult {
  const body = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const fields: Partial<Record<'rating' | 'title' | 'text', ReviewFieldCode>> = {};
  const value: { rating?: 1 | 2 | 3 | 4 | 5; title?: string; text?: string } = {};

  if (body.rating === undefined || body.rating === null || body.rating === '') {
    if (!opts.partial) fields.rating = 'rating_required';
  } else if (typeof body.rating === 'number' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5) {
    value.rating = body.rating as 1 | 2 | 3 | 4 | 5;
  } else {
    fields.rating = 'rating_invalid';
  }

  if (typeof body.title === 'string') {
    const title = sanitizeText(body.title).replace(/\n/g, ' ');
    if (length(title) > TITLE_MAX) fields.title = 'title_too_long';
    else value.title = title;
  }
  if (typeof body.text === 'string') {
    const text = sanitizeText(body.text);
    if (length(text) > TEXT_MAX) fields.text = 'text_too_long';
    else value.text = text;
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: value as ValidReview };
}

/** "Maya O.": first name (30 characters, controls removed) and the last initial. Never an email. */
export function authorName(first?: string | null, last?: string | null): string {
  const clean = (s: string | null | undefined) => sanitizeText(s ?? '').replace(/\s+/g, ' ');
  const f = [...clean(first)].slice(0, 30).join('').trim();
  const l = [...clean(last)][0];
  const base = f.includes('@') ? '' : f;
  const initial = l && l !== '@' ? `${l.toUpperCase()}.` : '';
  return [base, initial].filter(Boolean).join(' ') || 'Customer';
}
