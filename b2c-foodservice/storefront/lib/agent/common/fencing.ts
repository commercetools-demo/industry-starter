// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/fencing.py; changes: TypeScript port; Unicode regex flag, replace-only global regexes, bounded fixpoint loop, surrogate-safe cuts, JSON.stringify for the payload body.

/**
 * Sanitizing and fencing text the model reads as data. Each role defines one `Fence`; its label is a source literal, never built
 * from runtime values, so untrusted text cannot reproduce the boundary. Every pattern here is linear on hostile input: it runs on
 * the event loop before truncation.
 */

/** The configs' default `maxFencedChars`. Do not raise it: it sits behind a cache breakpoint's worth of prompt bytes. */
export const MAX_FENCED_CHARS = 12_000;

/** Hard ceiling for the marker-removal fixpoint loop. Python loops unconditionally; on a request path a future pattern that does not converge must not hang. */
const MAX_STRIP_PASSES = 32;

// Zero-width, bidi and format controls: the usual carriers for hidden instructions. Same table as upstream, built into a class at
// module load (numeric ranges are easier to audit than a wall of escapes).
// TRAP: the `u` flag is load-bearing. The tag characters (0xE0000 to 0xE007F) are astral; without `u` the class is parsed as UTF-16
// units and starts eating ordinary letters.
// A global regex is used only through String.replace (which resets lastIndex), never `.test()`.
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00ad, 0x00ad], // soft hyphen
  [0x200b, 0x200f], // zero-width space/joiners, LRM/RLM
  [0x2028, 0x2029], // line/paragraph separators
  [0x202a, 0x202e], // bidi embedding/overrides
  [0x2060, 0x2064], // word joiner, invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0x061c, 0x061c], // Arabic letter mark
  [0x180e, 0x180e], // Mongolian vowel separator
  [0x206a, 0x206f], // deprecated format controls
  [0xfe00, 0xfe0f], // variation selectors
  [0xfff9, 0xfffb], // interlinear annotation controls
  [0xfeff, 0xfeff], // byte-order mark / zero-width no-break space
  [0xe0000, 0xe007f], // tag characters, which spell invisible ASCII
  [0xe0100, 0xe01ef], // variation selectors supplement
];
const hexEscape = (cp: number): string => '\\u{' + cp.toString(16) + '}';
const INVISIBLE = new RegExp('[' + INVISIBLE_RANGES.map(([lo, hi]) => hexEscape(lo) + '-' + hexEscape(hi)).join('') + ']', 'gu');

// C0/C1 control characters except tab and newline.
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;

// A forged turn boundary: a blank line, then a full role word and a colon. Mid-sentence role words, single-newline headings and
// one-letter list markers ("A:") do not match.
const TURN_INDICATOR = /((?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)[ \t]*)(human|assistant|system|user)[ \t]*:/gi;

// The same marker at the start of a body: the fence's own newline would complete the blank line, which the in-body pattern cannot
// see, so it is applied at wrap time. Not global: used with replace only.
const LEADING_TURN_INDICATOR = /^(\s*)(human|assistant|system|user)[ \t]*:/i;

// Transcript and tool-call markup, optionally namespaced. Only tag-shaped text matches (bare, closing, or with name="value"
// attributes), so "<system requirements>" passes; `parameter` and `result` count only when namespaced. Quantifiers are bounded and
// non-adjacent, which is what keeps this linear on unclosed input.
const TAG_ATTRS = String.raw`(?:[ \t]+[\w:.-]{1,40}[ \t]*=[ \t]*(?:"[^"]{0,200}"|'[^']{0,200}'|[^\s"'>]{1,200})){0,8}`;
const SPECIAL_TOKEN = new RegExp(
  String.raw`<[ \t]*/?[ \t]*(?:` +
    String.raw`(?:[a-z][\w.-]{0,30}:)?(?:transcript|conversation|function_calls|function_results` +
    String.raw`|invoke|tool_use|tool_result|system|human|user|assistant)` +
    String.raw`|[a-z][\w.-]{0,30}:(?:parameter|result)` +
    String.raw`)\b` +
    TAG_ATTRS +
    String.raw`[ \t]*/?>` +
    String.raw`|<\|[^|<>\r\n]{1,64}\|>`,
  'gi',
);

const WHITESPACE_RUN = /\s+/g;

const markerCache = new Map<string, RegExp>();

/**
 * A marker is the label after an opening bracket, with or without the slash, spaces, attributes or the closing bracket
 * (`</label x="">`, `< /label>`, `</label`). Cached per label; global, so only ever used with `String.replace`.
 */
function markerPattern(label: string): RegExp {
  let pattern = markerCache.get(label);
  if (!pattern) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(String.raw`<\s*/?\s*${escaped}(?![A-Za-z0-9_])(?:[^<>]*>)?`, 'gi');
    markerCache.set(label, pattern);
  }
  return pattern;
}

/** Cut to `max` UTF-16 units without leaving half a surrogate pair at the end (Python slices by code point; JavaScript does not). */
function cut(text: string, max: number): string {
  if (max >= text.length) return text;
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

const TRUNCATION_SUFFIX = ' ...[truncated]';

export interface Fence {
  readonly label: string;
  readonly notice: string;
  readonly open: string;
  readonly close: string;
  sanitizeText(text: string, maxChars?: number): string;
  sanitizeValue(value: unknown, maxChars?: number): unknown;
  fencePayload(payload: unknown, maxChars?: number): string;
}

/** The tag that wraps third-party content and the notice the static prompt carries about it. */
export function createFence(label: string, notice: string): Fence {
  const open = `<${label}>`;
  const close = `</${label}>`;

  /** `maxChars` bounds the result including the truncation suffix, so a schema limit can be passed as is. */
  function sanitizeText(input: string, maxChars?: number): string {
    let text = input.normalize('NFKC');
    text = text.replace(INVISIBLE, '');
    text = text.replace(CONTROL, ' ');
    // Markers and tokens are removed to a fixpoint, so one nested inside another (`</label</label>>`) does not reassemble after
    // the inner one goes.
    const marker = markerPattern(label);
    for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
      const stripped = text.replace(marker, '[removed]').replace(SPECIAL_TOKEN, '[removed]');
      if (stripped === text) break;
      text = stripped;
    }
    text = text.replace(TURN_INDICATOR, '$1$2 -');
    if (maxChars !== undefined && text.length > maxChars) {
      text = maxChars > TRUNCATION_SUFFIX.length ? cut(text, maxChars - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX : cut(text, maxChars);
    }
    return text;
  }

  function sanitizeValue(value: unknown, maxChars?: number): unknown {
    if (typeof value === 'string') return sanitizeText(value, maxChars);
    if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, maxChars));
    if (value !== null && typeof value === 'object') {
      // Note: integer-like keys are hoisted by JavaScript; payload builders spell their key order out as ordered literals.
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[sanitizeText(String(k), 200)] = sanitizeValue(v, maxChars);
      return out;
    }
    return value;
  }

  /** The sanitized payload inside the fence. String leaves are sanitized in place; the body is cut at `maxChars` with a visible marker. */
  function fencePayload(payload: unknown, maxChars: number = MAX_FENCED_CHARS): string {
    const sanitized = sanitizeValue(payload);
    let body = typeof sanitized === 'string' ? sanitized : (JSON.stringify(sanitized) ?? 'null');
    if (body.length > maxChars) body = cut(body, maxChars) + TRUNCATION_SUFFIX;
    body = body.replace(LEADING_TURN_INDICATOR, '$1$2 -');
    return `${open}\n${body}\n${close}`;
  }

  return { label, notice, open, close, sanitizeText, sanitizeValue, fencePayload };
}

// Enforced at payload validation rather than in the tool schema, which is frozen.
export const SUGGESTION_CHIP_MAX_CHARS = 80;

/** Model text shown to a person as one line (a chip, a status line): invisible and control characters out, whitespace collapsed, cut to `maxChars` with an ellipsis; empty when nothing visible is left. */
export function sanitizeLabel(text: unknown, maxChars: number): string {
  let line = String(text ?? '').replace(INVISIBLE, '');
  line = line.replace(CONTROL, ' ');
  line = line.replace(WHITESPACE_RUN, ' ').trim();
  if (line.length > maxChars) line = cut(line, maxChars - 1).trimEnd() + '…';
  return line;
}

/** Chips as one-line button labels: each through `sanitizeLabel`, empty ones dropped, at most `maxChips`. */
export function sanitizeSuggestionChips(chips: readonly string[], maxChips = 4, maxChars = SUGGESTION_CHIP_MAX_CHARS): string[] {
  const cleaned: string[] = [];
  for (const chip of chips) {
    const label = sanitizeLabel(chip, maxChars);
    if (label) cleaned.push(label);
    if (cleaned.length === maxChips) break;
  }
  return cleaned;
}

/** Text shown to a person, cut at a word boundary with an ellipsis. */
export function truncateDisplay(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let piece = cut(text, maxChars - 1);
  const space = piece.lastIndexOf(' ');
  if (space >= 0) piece = piece.slice(0, space);
  return piece.replace(/[ ,;:\-—–]+$/, '') + '…';
}
