/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Preview rendering of a stored template (W-04). Values and literal text are HTML-escaped, newlines become <br>. Pure.
import type { EmailVariable } from './variables';

export const SAMPLE_VARIABLES: Record<EmailVariable, string> = { order_number: 'MO-482913', customer_name: 'Alex Muster' };

const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Plain interpolation (for the subject line, which is shown as text). Unknown names become empty. */
export function renderText(text: string, vars: Record<string, string>): string {
  return text.replace(VARIABLE, (_m, name: string) => vars[name] ?? '');
}

/** Safe HTML of a body: literal text and values escaped, line breaks as <br>. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  let out = '';
  let last = 0;
  for (const match of text.matchAll(VARIABLE)) {
    out += escapeHtml(text.slice(last, match.index));
    out += escapeHtml(vars[match[1]] ?? '');
    last = (match.index ?? 0) + match[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\r\n|\r|\n/g, '<br>');
}
