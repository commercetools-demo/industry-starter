// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/grounding.py; changes: TypeScript port; no global/sticky regex objects are cached (a global regex carries lastIndex between .test() calls); \b is ASCII-only in JavaScript where Python's is Unicode-aware (see matchesAny).

/**
 * Grounding rules: a rule reads the user's message and names one read tool the turn must start with, so an answer of that shape begins
 * from a tool result. Each role lists its rules in precedence order; the runtime forces the first rule that fires (`tool_choice` on the
 * turn's first iteration). The lexicons are config, not prompt bytes; this module only matches.
 */

// A concrete money or percent figure counts as a change term on its own.
const MONEY_LITERAL = /\$\s?\d/;
const PERCENT_LITERAL = /\d+\s?%/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive whole-word (or whole-phrase) match; `?` matches literally.
 *
 * TRAP: `\b` and `\w` are ASCII-only in JavaScript and Unicode-aware in Python. A boundary around a non-ASCII letter behaves differently
 * on the two sides. We do not emulate it: where it matters (a non-English lexicon) carry both the accented and the accent-free spelling.
 * A missed term only costs one wording; a false positive only costs one forced read. This store serves en-US and en-CA, so all lexicons are ASCII.
 */
export function matchesAny(text: string, needles: readonly string[]): boolean {
  const lowered = text.toLowerCase();
  for (const needle of needles) {
    const cleaned = needle.toLowerCase().trim();
    if (!cleaned) continue;
    if (cleaned === '?') {
      if (lowered.includes('?')) return true;
    } else if (new RegExp(`\\b${escapeRegExp(cleaned)}\\b`).test(lowered)) {
      return true;
    }
  }
  return false;
}

/** True when the text carries a term and a cue. With `numericLiterals` a money or percent figure also counts as a term. Empty text or an empty lexicon never fires. */
export function matchesTermsAndCues(text: string, terms: readonly string[], cues: readonly string[], numericLiterals = false): boolean {
  if (!text || terms.length === 0 || cues.length === 0 || !matchesAny(text, cues)) return false;
  if (matchesAny(text, terms)) return true;
  return numericLiterals && (MONEY_LITERAL.test(text) || PERCENT_LITERAL.test(text));
}

/** The longest match of any pattern in the text (case-insensitive), or null. Patterns are regex SOURCES, compiled here per call so no `lastIndex` state is shared. */
export function findToken(text: string, patterns: readonly string[]): string | null {
  let token: string | null = null;
  if (!text) return token;
  for (const pattern of patterns) {
    const match = new RegExp(pattern, 'i').exec(text);
    if (match !== null && (token === null || match[0].length > token.length)) token = match[0];
  }
  return token;
}

/** `fires(config, text, state)` returns the input for `tool` when the rule applies, else null. `prefetchIntro` renders the line a prefetching host puts above the tool result; this runtime forces tools with `tool_choice` so none is needed. */
export interface GroundingRule<Config = unknown, State = unknown> {
  readonly name: string;
  readonly tool: string;
  readonly fires: (config: Config, text: string, state: State) => Record<string, unknown> | null;
  readonly prefetchIntro?: (args: Record<string, unknown>) => string;
}

/** The tool the turn's first iteration is pinned to, by rule precedence. */
export function firstForcedTool<Config, State>(rules: readonly GroundingRule<Config, State>[], config: Config, text: string, state: State): string | null {
  for (const rule of rules) {
    if (rule.fires(config, text, state) !== null) return rule.tool;
  }
  return null;
}

/**
 * The grounding rule as an instruction, for models that reject a forced `tool_choice` (see `supportsForcedToolChoice`): the round runs
 * with `auto` and this line goes into the per-turn context block, after the cache breakpoint and outside the data fence (it is
 * runtime-authored, not catalogue data). Deterministic, so every round of a turn sends the same bytes.
 */
export function groundingInstruction(tool: string): string {
  return `# Required first step\n\nThis message must be answered from fresh data: call the \`${tool}\` tool before you reply, and base the reply on its result.`;
}
