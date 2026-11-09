// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/prompt_assembly.py; changes: TypeScript port; the clock is formatted from Intl parts in the session zone (JavaScript has no timezone-aware datetime); the rolling marker walks back to the newest MARKABLE block instead of marking the last unconditionally.

import type { ToolDefinition } from './execution';

/**
 * Where the cache breakpoints go: after the static system text, after the last tool, and rolling through the conversation on the newest
 * persisted message; and where the per-request context goes: a second system block, behind the static one's marker.
 *
 * The request's stable prefix is the tool array and the static system text; the rolling marker makes the rounds of a turn cache reads as
 * well. Everything per request (the cart, the page, the clock) is the second system block, and it is the same bytes from one turn to the
 * next until the state in it changes: a turn whose state has not moved reads the whole conversation from cache.
 */

export interface CacheControl {
  type: 'ephemeral';
}
export interface TextBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}
export type ContentBlock = Record<string, unknown> & { type: string };
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * The session clock as the context block carries it: the current HOUR with the session's UTC offset, e.g. `2026-09-03T11:00+02:00`.
 * Rendering the minutes would change the block, and so re-read the conversation, on nearly every turn. `timeZone` is an IANA zone the
 * caller has already validated (an unknown zone means no clock line at all, decided by the caller); without one the offset is `+00:00`.
 * Byte-for-byte tested: a wrong string shows up only as a cache-read regression.
 */
export function contextClock(now: Date, timeZone?: string): string {
  const zone = timeZone ?? 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMinutes = Math.round((local - Math.floor(now.getTime() / 1000) * 1000) / 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${get('year')}-${pad(get('month'))}-${pad(get('day'))}T${pad(get('hour'))}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** The system prompt: the static text carrying the cache breakpoint, then the per-request context behind it. Nothing per request goes in the first block; a byte's change there would re-read the tool array and the static text on every call. */
export function buildSystemBlocks(staticText: string, context: string): TextBlock[] {
  return [{ type: 'text', text: staticText, cache_control: { type: 'ephemeral' } }, { type: 'text', text: context }];
}

/** Ask the API to stream these tools' input as it is generated, so a card's first item can render at its first key. The input then arrives as written, valid JSON or not; the turn loop answers a call whose input does not parse as an error. Applied to the request copy; the registry's bytes stay as built. */
export function withEagerInput(tools: readonly ToolDefinition[], names: ReadonlySet<string>): ToolDefinition[] {
  return tools.map((t) => (names.has(t.name) ? { ...t, eager_input_streaming: true } : t));
}

/** Marker on the LAST tool, so the whole array caches. It is the outermost stable prefix. */
export function withToolCacheControl(tools: readonly ToolDefinition[]): ToolDefinition[] {
  if (tools.length === 0) return [];
  const copy = tools.map((t) => ({ ...t }));
  copy[copy.length - 1] = { ...copy[copy.length - 1], cache_control: { type: 'ephemeral' } };
  return copy;
}

const blocks = (raw: Message['content'] | undefined): ContentBlock[] => (typeof raw === 'string' ? [{ type: 'text', text: raw }] : [...(raw ?? [])]);

/** Not every content-block kind accepts a cache marker: a thinking block is rejected with a 400, and an empty text block too. */
function markable(block: ContentBlock): boolean {
  if (block.type === 'thinking' || block.type === 'redacted_thinking') return false;
  if (block.type === 'text' && (typeof block.text !== 'string' || block.text === '')) return false;
  return true;
}

function withoutMarker(message: Message): Message {
  if (!Array.isArray(message.content) || !message.content.some((b) => 'cache_control' in b)) return message;
  return { ...message, content: message.content.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'cache_control')) as ContentBlock) };
}

/**
 * The outgoing request's messages: a request-shaped copy of `messages` with the rolling cache breakpoint on the newest persisted
 * MARKABLE content block. Within a turn the system blocks are constant, so the marker makes each round's prior rounds (the long tool
 * results especially) a cache read instead of a reprocess. Two cases skip it. A bare first call (one message) would write an entry a
 * one-shot session never reads. And the caller passes `rollingBreakpoint: false` on rounds whose `tool_choice` is not `auto`, because
 * `tool_choice` keys the messages span: an entry written under a forced round is unreadable by the auto rounds that follow.
 *
 * A turn that closed on a presentation round leaves a tool_result message followed by the next user message; the two go out as one user
 * message, tool_result blocks first. Applied per call to the outgoing request only: the returned list shallow-copies the touched
 * message and blocks, strips any marker an earlier call placed, and NEVER mutates the host's persisted history.
 */
export function buildRequestMessages(messages: readonly Message[], opts: { rollingBreakpoint?: boolean } = {}): Message[] {
  const rolling = opts.rollingBreakpoint ?? true;
  if (messages.length === 0) return [];
  const request: Message[] = [];
  for (const original of messages) {
    const message = withoutMarker(original);
    const last = request[request.length - 1];
    if (last && message.role === 'user' && last.role === 'user') {
      request[request.length - 1] = { ...last, content: [...blocks(last.content), ...blocks(message.content)] };
    } else {
      request.push(message);
    }
  }
  if (!rolling || request.length < 2) return request;
  for (let m = request.length - 1; m >= 0; m -= 1) {
    const content = blocks(request[m].content);
    for (let b = content.length - 1; b >= 0; b -= 1) {
      if (markable(content[b])) {
        content[b] = { ...content[b], cache_control: { type: 'ephemeral' } };
        request[m] = { ...request[m], content };
        return request;
      }
    }
  }
  return request;
}
