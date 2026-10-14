/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// E-mail template variables (workstream W-04). Pure. Templates are stored and previewed only: nothing is ever sent (Q-P01).
export const EMAIL_VARIABLES = ['order_number', 'customer_name'] as const;
export type EmailVariable = (typeof EMAIL_VARIABLES)[number];

const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Names used in `{{ name }}` placeholders that are not in the supported list, in order of first appearance. */
export function findUnknownVariables(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1];
    if (!(EMAIL_VARIABLES as readonly string[]).includes(name) && !unknown.includes(name)) unknown.push(name);
  }
  return unknown;
}

/** True when a `{{` or `}}` is left over after every well-formed placeholder is removed. */
export function hasUnbalancedBraces(text: string): boolean {
  const rest = text.replace(VARIABLE, '');
  return rest.includes('{{') || rest.includes('}}');
}

export type TemplateProblem = { code: 'UNKNOWN_VARIABLE'; variable: string } | { code: 'UNBALANCED_BRACES' };

/** The first problem of one text, or null when it is fine. Unbalanced braces are checked first. */
export function templateProblem(text: string): TemplateProblem | null {
  if (hasUnbalancedBraces(text)) return { code: 'UNBALANCED_BRACES' };
  const [variable] = findUnknownVariables(text);
  return variable ? { code: 'UNKNOWN_VARIABLE', variable } : null;
}
