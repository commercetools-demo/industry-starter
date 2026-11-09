// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/turn.py; changes: TypeScript port over the RAW event stream (the round is accumulated here, never by the SDK's tolerant accumulator, so a non-JSON streamed tool input never throws from inside the iterator); no asyncio tasks (a started promise gets its rejection handler at storage time and cancellation is an AbortSignal); memory extraction helpers not ported.

import { createHash } from 'node:crypto';
import type { ContentBlock, Message } from './prompt-assembly';
import { CHIPS_TOOL, type PresentationComponent, enrichPartial } from './presentation';
import { AgentEvents, type AgentEvent, type ToolOutcome, ToolOutcomes, parsePartialJson } from './streaming';

/**
 * Pieces of the Messages API turn loop that both roles use the same way: reading the conversation (latest user text, compaction), running
 * a round (`StreamedRound`, eager dispatch, the test for a round that ends the turn on its chips), and recording it (host events,
 * `tool_result` blocks, usage, the model-call log record).
 */

// Tool results longer than this collapse to "ok" in the trace, with an excerpt. The whole fenced payload is already in the model's context
// and does not need to cross the wire to the browser as well; a REFUSED result keeps its full text (that text is the instruction the
// person may need to see).
const SUMMARY_MAX_CHARS = 200;
const EXCERPT_MAX_CHARS = 1200;
export const CLEARED_RESULT = '[result cleared from an earlier turn; call the tool again if it is needed]';
/** The result of a call whose streamed input never became JSON; the input is NOT echoed back (it is model text that failed to parse, and quoting it invites the same bytes). */
export const UNREADABLE_INPUT_TEXT = 'The arguments for this call did not arrive as valid JSON, so it was not run. Send the call again.';
export const INTERRUPTED_RESULT_TEXT = 'The turn was interrupted before this call returned; call it again if it is still needed.';

type Block = Record<string, unknown>;

function textBlocks(content: Message['content'] | undefined): string[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === 'text').map((b) => String(b.text ?? ''));
}

/** The most recent user-authored text; "" when the conversation has none. */
export function latestUserText(messages: readonly Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    const texts = textBlocks(message.content);
    if (texts.length > 0) return texts.join('\n');
    // A message of tool results is the loop's own; anything else ends the search.
    if (Array.isArray(message.content) && message.content.some((b) => b?.type === 'tool_result')) continue;
    return '';
  }
  return '';
}

/** What a log record carries in place of a session id, which is also the request credential: the first twelve hex digits of its SHA-256, so the lines of one session correlate and an operator holding the id can compute the tag, but a log reader cannot use it. */
export function sessionTag(sessionId: string | null | undefined): string {
  return sessionId ? createHash('sha256').update(sessionId).digest('hex').slice(0, 12) : '-';
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export function usageTotals(): Usage {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

const USAGE_KEYS = Object.keys(usageTotals()) as (keyof Usage)[];

export function accumulateUsage(totals: Usage, round: Usage): void {
  for (const key of USAGE_KEYS) totals[key] += round[key] ?? 0;
}

/** The size of the prompt a call was given, as the model counted it: fresh input plus what was read from and written to the cache. */
export function promptTokens(usage: Usage): number {
  return usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens;
}

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

/** One line per model call: the session's TAG (never the id), the round, the model, the stop reason, the four usage counters and the time. Never a body: a request body contains every injected fact and the whole cart. */
export function logModelCall(model: string, stopReason: string | null, usage: Usage, startedAt: number, sessionId: string | undefined, round: number): void {
  console.info(
    JSON.stringify({
      event: 'assistant_model_call',
      session: sessionTag(sessionId),
      round,
      model,
      stop: stopReason,
      input: usage.input_tokens,
      cache_read: usage.cache_read_input_tokens,
      cache_write: usage.cache_creation_input_tokens,
      output: usage.output_tokens,
      elapsed_ms: elapsedMs(startedAt),
    }),
  );
}

/**
 * After a turn whose last call was given `maxTokens` or more, replace the oldest tool results in the stored conversation with
 * `CLEARED_RESULT` until it is half its size, and return how many were cleared; 0 turns this off. The next turn's first round rewrites the
 * cached span once and every round after reads the shorter one. Provenance lives on the session state, so nothing a gate checks is cleared.
 * The caller must then rewrite the stored transcript WHOLE (a store that only appends would keep the uncompacted prefix).
 */
export function compactHistory(messages: Message[], lastPromptTokens: number, maxTokens: number, sessionId: string): number {
  if (!maxTokens || lastPromptTokens < maxTokens) return 0;
  let size = JSON.stringify(messages).length;
  const target = Math.floor(size / 2);
  let cleared = 0;
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (size <= target) break;
      if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > CLEARED_RESULT.length) {
        size -= block.content.length - CLEARED_RESULT.length;
        block.content = CLEARED_RESULT;
        cleared += 1;
      }
    }
  }
  console.info(JSON.stringify({ event: 'assistant_history_compacted', session: sessionTag(sessionId), prompt_tokens: lastPromptTokens, results_cleared: cleared }));
  return cleared;
}

/** Await a prefetch; undefined when it fails (logged by name only) or when `promise` is null (a slot the deployment switches off), so the turn goes ahead without that slot. */
export async function fetched<T>(name: string, promise: Promise<T> | null | undefined): Promise<T | undefined> {
  if (!promise) return undefined;
  try {
    return await promise;
  } catch {
    console.warn(JSON.stringify({ event: 'assistant_prefetch_failed', prefetch: name }));
    return undefined;
  }
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool execution started mid-stream. When a `tool_use` block's buffered JSON parses STRICTLY at `content_block_stop`, the call's arguments
 * are final: execution starts then, while the model writes the rest of the round, so tool time overlaps generation time. NEVER dispatch off
 * a tolerant parse: a cart write on a half-written object is a write with the wrong quantity.
 *
 * `collect` is the post-stream join: started calls are awaited, anything the stream path missed executes from the final canonical args, and
 * every call runs exactly once.
 *
 * Promise cancellation does not exist: a started call is cancelled by the turn's AbortSignal (which the backend honours), and EVERY started
 * promise gets a rejection handler at storage time. That is not tidiness: in Node an unhandled rejection terminates the process by default,
 * which on a shared serverless instance takes down every other in-flight request.
 */
export class EagerDispatcher {
  private readonly tasks = new Map<string, Promise<ToolOutcome>>();

  constructor(
    private readonly execute: (name: string, args: Record<string, unknown>) => Promise<ToolOutcome>,
    private readonly enabled: boolean,
  ) {}

  started(toolUseId: string): boolean {
    return this.tasks.has(toolUseId);
  }

  /** Start `name` on `args`; false when it did not start (dispatch off, already started, or no parsed args) and the join executes it later. */
  dispatch(name: string, toolUseId: string, args: Record<string, unknown> | null): boolean {
    if (!this.enabled || args === null || this.tasks.has(toolUseId)) return false;
    this.store(toolUseId, this.execute(name, args));
    return true;
  }

  /** Give `toolUseId` its outcome without executing it (a call whose input never parsed); the join returns it in place. A started call keeps its task. */
  settle(toolUseId: string, outcome: ToolOutcome): void {
    if (!this.tasks.has(toolUseId)) this.store(toolUseId, Promise.resolve(outcome));
  }

  collect(toolUses: readonly ToolUse[]): Promise<ToolOutcome[]> {
    return Promise.all(toolUses.map((block) => this.tasks.get(block.id) ?? this.execute(block.name, block.input)));
  }

  private store(id: string, task: Promise<ToolOutcome>): void {
    task.catch(() => undefined); // the handler at storage time: see the class comment
    this.tasks.set(id, task);
  }
}

export interface RawEvent {
  type: string;
  [key: string]: unknown;
}

interface StreamedTool {
  name: string;
  id: string;
  /** A server tool (web search): its input is recorded and never dispatched. */
  server: boolean;
  buffer: string;
  closed: boolean;
  /** The key of the last `ui_partial` frame this call produced. */
  signature: string | null;
}

function parseStrict(buffer: string): Record<string, unknown> | null {
  try {
    const args: unknown = buffer.trim() === '' ? {} : JSON.parse(buffer);
    return args !== null && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The round's content blocks as the raw stream events deliver them, and the host events they produce on the way (`relay`). A tool's input
 * that streams as written (`withEagerInput`) can arrive as text that is not JSON: it is parsed STRICTLY from our own buffer, never through
 * an SDK getter, so a malformed call is answered with an error result and the model sends it again, instead of the iterator throwing.
 * `usage` is the stream's own counts (cumulative: the latest value of each key REPLACES ours; adding them multiplies the reported tokens by
 * the number of delta events).
 */
export class StreamedRound {
  readonly blocks: Block[] = [];
  readonly tools = new Map<number, StreamedTool>();
  readonly usage: Usage = usageTotals();
  stopReason: string | null = null;

  constructor(
    private readonly specs: ReadonlyMap<string, PresentationComponent<never, never, never>>,
    private readonly partialTools: ReadonlySet<string>,
    private readonly state: unknown,
    private readonly eagerFrames: boolean,
  ) {}

  /** Record one raw stream event; returns the tool it touched, if any. */
  feed(raw: RawEvent): StreamedTool | null {
    if (raw.type === 'message_start' || raw.type === 'message_delta') {
      const counts = (raw.type === 'message_start' ? (raw.message as { usage?: Record<string, unknown> } | undefined)?.usage : (raw.usage as Record<string, unknown> | undefined)) ?? {};
      for (const key of USAGE_KEYS) if (typeof counts[key] === 'number') this.usage[key] = counts[key] as number;
      if (raw.type === 'message_delta') {
        const reason = (raw.delta as { stop_reason?: unknown } | undefined)?.stop_reason;
        if (typeof reason === 'string') this.stopReason = reason;
      }
      return null;
    }
    const index = raw.index;
    if (typeof index !== 'number') return null;
    if (raw.type === 'content_block_start') {
      const start = raw.content_block as Block;
      const entry: Block = Object.fromEntries(Object.entries(start).filter(([k]) => k !== 'citations'));
      const kind = entry.type;
      // The streamed fields start empty here and grow from the deltas.
      if (kind === 'text') entry.text = '';
      else if (kind === 'thinking') entry.thinking = '';
      else if (kind === 'tool_use' || kind === 'server_tool_use') {
        entry.input = {};
        this.tools.set(index, { name: String(start.name), id: String(start.id), server: kind === 'server_tool_use', buffer: '', closed: false, signature: null });
      }
      this.blocks[index] = entry;
      return this.tools.get(index) ?? null;
    }
    if (raw.type === 'content_block_delta') {
      const delta = raw.delta as { type?: string; partial_json?: string; text?: string; thinking?: string; signature?: string };
      const tool = this.tools.get(index);
      if (tool) {
        if (delta.type === 'input_json_delta') tool.buffer += delta.partial_json ?? '';
        return tool;
      }
      const entry = this.blocks[index];
      if (!entry) return null;
      if (delta.type === 'text_delta') entry.text = String(entry.text ?? '') + (delta.text ?? '');
      else if (delta.type === 'thinking_delta') entry.thinking = String(entry.thinking ?? '') + (delta.thinking ?? '');
      else if (delta.type === 'signature_delta') entry.signature = delta.signature;
      return null;
    }
    if (raw.type === 'content_block_stop') {
      const tool = this.tools.get(index);
      if (!tool) return null;
      tool.closed = true;
      if (tool.server) {
        const args = parseStrict(tool.buffer);
        if (args) this.blocks[index].input = args;
      }
      return tool;
    }
    return null;
  }

  /** The `ui_partial` event for `tool` after its latest input delta, or null. By default a frame goes out on structural change only, so the stream stays light and no half-written string renders; with `eagerFrames` every visible payload change emits, so text inside a card grows as it generates. */
  private frame(tool: StreamedTool): AgentEvent | null {
    if (!this.partialTools.has(tool.name)) return null;
    const spec = this.specs.get(tool.name);
    if (!spec) return null;
    const parsed = parsePartialJson(tool.buffer, !this.eagerFrames);
    const partial = parsed ? enrichPartial(spec as PresentationComponent<never, never, unknown>, parsed, this.state) : null;
    if (!partial) return null;
    const key = this.eagerFrames ? stableStringify(partial.payload) : partial.signature;
    if (key === tool.signature) return null;
    tool.signature = key;
    return AgentEvents.uiPartial(partial.component, partial.payload, tool.id);
  }

  /**
   * Feed every raw event of `stream` through this round and yield the host events it produces meanwhile: text deltas, partial frames, and
   * `announce`'s `tool_call` event for each call eager dispatch starts when its block closes. Anything a partial hook raises propagates.
   */
  async *relay(stream: AsyncIterable<RawEvent>, dispatcher: EagerDispatcher, announce: (name: string, id: string, input: Record<string, unknown>) => AgentEvent): AsyncGenerator<AgentEvent> {
    for await (const raw of stream) {
      const tool = this.feed(raw);
      if (raw.type === 'content_block_delta') {
        const delta = raw.delta as { type?: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) yield AgentEvents.textDelta(delta.text);
        else if (tool) {
          const frame = this.frame(tool);
          if (frame) yield frame;
        }
      } else if (raw.type === 'content_block_stop' && tool && !tool.server) {
        const args = parseStrict(tool.buffer);
        if (dispatcher.dispatch(tool.name, tool.id, args)) yield announce(tool.name, tool.id, args ?? {});
      }
    }
  }

  /**
   * The round as the stream delivered it: the assistant message for the conversation, the client tool calls in it, and the ids whose input
   * never parsed (recorded with `{}` as input, so the stored message is valid for the next request).
   */
  finish(): { reply: Message | null; toolUses: ToolUse[]; unreadable: Set<string> } {
    const unreadable = new Set<string>();
    const toolUses: ToolUse[] = [];
    this.blocks.forEach((entry, index) => {
      const tool = this.tools.get(index);
      if (!tool) return;
      const parsed = tool.closed ? parseStrict(tool.buffer) : null;
      if (parsed) entry.input = parsed;
      else {
        entry.input = {};
        unreadable.add(tool.id);
      }
      if (!tool.server) toolUses.push({ id: tool.id, name: tool.name, input: entry.input as Record<string, unknown> });
    });
    const content = this.blocks.filter((e) => e && (e.type !== 'text' || e.text)) as unknown as ContentBlock[];
    return { reply: content.length > 0 ? { role: 'assistant', content } : null, toolUses, unreadable };
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v));
}

/** A call whose input never parsed is settled as an error so the model sends it again; one WARNING per call names it and the SIZE of what arrived, never the input. */
export function settleUnreadable(round: StreamedRound, dispatcher: EagerDispatcher, unreadable: ReadonlySet<string>, sessionId: string | undefined, roundIndex: number): void {
  for (const tool of round.tools.values()) {
    if (!unreadable.has(tool.id)) continue;
    console.warn(JSON.stringify({ event: 'assistant_tool_input_unreadable', session: sessionTag(sessionId), round: roundIndex, tool: tool.name, chars: tool.buffer.length }));
    if (!tool.server) dispatcher.settle(tool.id, ToolOutcomes.error(UNREADABLE_INPUT_TEXT));
  }
}

/** The host events for one finished tool call: the outcome's own events (`ui` events stamped with the call id so a streamed card keeps its slot), then its `tool_result`. */
export function* outcomeEvents(tool: string, toolUseId: string, outcome: ToolOutcome): Generator<AgentEvent> {
  for (const event of outcome.events) yield event.type === 'ui' ? { ...event, data: { ...event.data, stream_id: toolUseId } } : event;
  const refused = outcome.isError || outcome.blocked !== undefined;
  const keepText = refused || outcome.resultText.length < SUMMARY_MAX_CHARS;
  yield AgentEvents.toolResult(tool, toolUseId, keepText ? outcome.resultText : 'ok', {
    isError: outcome.isError,
    ...(outcome.blocked ? { status: 'blocked' as const, reason: outcome.blocked } : {}),
    ...(keepText ? {} : { excerpt: outcome.resultText.slice(0, EXCERPT_MAX_CHARS) }),
  });
}

/** True when a round can end the turn with no closing model call: the chips tool succeeded in it and every call in it is one `clean` accepts (a presentation call that was not refused, held or annotated). A turn can legitimately produce NO prose. */
export function roundClosesTurn(calls: readonly (readonly [string, ToolOutcome])[], clean: (name: string, outcome: ToolOutcome) => boolean): boolean {
  return calls.some(([name]) => name === CHIPS_TOOL) && calls.every(([name, outcome]) => clean(name, outcome));
}

export function toolResultBlock(toolUseId: string, outcome: ToolOutcome): ContentBlock {
  return { type: 'tool_result', tool_use_id: toolUseId, content: outcome.resultText, is_error: outcome.isError };
}

/**
 * If the conversation ends on an assistant message whose `tool_use` blocks have no `tool_result` after them (the host closed the turn
 * mid-round, or a round raised), append one result per call so the stored conversation stays valid for the next request (the API rejects
 * a dangling tool call outright): the call's real outcome when `settled` has it (a write that finished is reported as done, not as one to
 * repeat), else an error naming the interruption. Returns how many results it appended.
 */
export function closeOpenToolUses(messages: Message[], settled: ReadonlyMap<string, ToolOutcome> = new Map()): number {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || !Array.isArray(last.content)) return 0;
  const ids = last.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.id));
  if (ids.length === 0) return 0;
  messages.push({
    role: 'user',
    content: ids.map((id) => {
      const outcome = settled.get(id);
      return outcome ? toolResultBlock(id, outcome) : { type: 'tool_result', tool_use_id: id, content: INTERRUPTED_RESULT_TEXT, is_error: true };
    }),
  });
  return ids.length;
}
