/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Turns a plain-language audience description into a rule (W-07, D3). A fixed set of phrases, no LLM (Q-W06): an unknown phrase
// gets a hint listing the categories. Pure.
import type { Rule } from './audience';

export interface CategoryName {
  key: string;
  /** Every localized name of the category (de-DE and en-US). */
  names: string[];
}

export type ParseResult = { ok: true; rule: Rule } | { ok: false; hint: string; categories: string[] };

const HINT = 'Try: customers who bought <category> but not <category>';

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.!?,;:"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Singular and plural forms match each other ("pads" and "pad"; "discs" and "disc"). */
const stem = (word: string) => word.replace(/(es|s)$/, '');
const stemPhrase = (text: string) => norm(text).split(' ').map(stem).join(' ');

function findCategory(phrase: string, categories: readonly CategoryName[]): CategoryName | null {
  const wanted = stemPhrase(phrase);
  if (!wanted) return null;
  const exact = categories.find((c) => c.names.some((n) => stemPhrase(n) === wanted));
  if (exact) return exact;
  // "pads" finds "Brake pads" when exactly one category name ends with the phrase.
  const ending = categories.filter((c) => c.names.some((n) => stemPhrase(n).endsWith(` ${wanted}`)));
  return ending.length === 1 ? ending[0] : null;
}

const UNITS: Record<string, number> = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30 };

export function parseDescription(description: string, categories: readonly CategoryName[]): ParseResult {
  const fail = (): ParseResult => ({ ok: false, hint: HINT, categories: categories.flatMap((c) => c.names.slice(0, 1)) });
  const text = norm(description);
  if (!text || text.length > 200) return fail();

  if (/^(all|registered)( registered)? customers$|^registered customers$/.test(text)) return { ok: true, rule: { all: [{ type: 'registered' }] } };

  const idle = /^(?:customers )?(?:who )?(?:have not|havent|haven t|did not|didnt|didn t|not) (?:ordered|bought|purchased)(?: anything)? (?:in|for|within) (?:the last )?(\d{1,4}) (days?|weeks?|months?)$/.exec(text);
  if (idle) {
    const days = Number(idle[1]) * UNITS[idle[2]];
    return days >= 1 ? { ok: true, rule: { all: [{ type: 'no-order-since', days }] } } : fail();
  }

  const both = /^(?:customers )?who bought (.+?) but not (.+)$/.exec(text);
  if (both) {
    const wanted = findCategory(both[1], categories);
    const excluded = findCategory(both[2], categories);
    if (wanted && excluded) return { ok: true, rule: { all: [{ type: 'bought-category', categoryKey: wanted.key }, { type: 'not-bought-category', categoryKey: excluded.key }] } };
    return fail();
  }

  const one = /^(?:customers )?who bought (.+)$/.exec(text);
  if (one) {
    const wanted = findCategory(one[1], categories);
    if (wanted) return { ok: true, rule: { all: [{ type: 'bought-category', categoryKey: wanted.key }] } };
  }
  return fail();
}
