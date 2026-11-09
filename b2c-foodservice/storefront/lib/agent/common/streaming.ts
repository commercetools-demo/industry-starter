// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/streaming.py; changes: TypeScript discriminated union with snake_case wire keys; partial-JSON parser hand-ported (a half-written string is dropped together with its key); JSON.parse for strict parsing.

/**
 * The events an agent turn yields to its host, and the outcome type every tool call produces. Hosts render the event types below and
 * ignore any they do not know. The full union is kept even for events this deployment never emits (`change_update` belongs to the
 * merchant role), so a reader who greps for an unhandled type finds a declaration rather than a mystery.
 *
 *  text_delta     {text}: incremental assistant text.
 *  tool_call      {tool, id, input[, label]}; `label` is the model's few words for the person waiting while the call runs (the call's
 *                 `status` argument), absent on presentation calls.
 *  tool_result    {tool, id, summary, is_error, status[, reason, excerpt]}; status is ok, error or blocked (a gate held the call;
 *                 `reason` names the gate).
 *  ui             {component, payload}: a validated, enriched component.
 *  ui_partial     The same, plus stream_id, while the call is still being generated; the final `ui` event carries the same stream_id.
 *  cart_update    {cart}: the whole cart.
 *  change_update  {change}: a staged change's whole record after it moved (merchant role; never emitted here).
 *  progress       {message[, tool, step]}: a status line to replace the previous one and clear on that tool's tool_result.
 *  turn_complete  {stop_reason, usage, elapsed_ms, results_cleared}: usage sums the turn's model calls; results_cleared counts earlier
 *                 tool results the turn compacted, so a host that appends its transcript rewrites it when this is nonzero.
 *  error          {message}, safe to show.
 */

export type EventType =
  | 'text_delta'
  | 'tool_call'
  | 'tool_result'
  | 'ui'
  | 'ui_partial'
  | 'cart_update'
  | 'change_update'
  | 'progress'
  | 'turn_complete'
  | 'error';

export interface AgentEvent {
  type: EventType;
  data: Record<string, unknown>;
}

export type ToolResultStatus = 'ok' | 'error' | 'blocked';

export const AgentEvents = {
  textDelta: (text: string): AgentEvent => ({ type: 'text_delta', data: { text } }),

  toolCall(tool: string, toolUseId: string, input: Record<string, unknown>, label?: string): AgentEvent {
    const data: Record<string, unknown> = { tool, id: toolUseId, input };
    if (label) data.label = label;
    return { type: 'tool_call', data };
  },

  toolResult(
    tool: string,
    toolUseId: string,
    summary: string,
    opts: { isError?: boolean; status?: ToolResultStatus; reason?: string; excerpt?: string } = {},
  ): AgentEvent {
    const isError = opts.isError ?? false;
    const data: Record<string, unknown> = { tool, id: toolUseId, summary, is_error: isError, status: opts.status ?? (isError ? 'error' : 'ok') };
    if (opts.reason) data.reason = opts.reason;
    if (opts.excerpt !== undefined) data.excerpt = opts.excerpt;
    return { type: 'tool_result', data };
  },

  ui: (component: string, payload: Record<string, unknown>): AgentEvent => ({ type: 'ui', data: { component, payload } }),

  uiPartial: (component: string, payload: Record<string, unknown>, streamId: string): AgentEvent => ({
    type: 'ui_partial',
    data: { component, payload, stream_id: streamId },
  }),

  cartUpdate: (cart: Record<string, unknown>): AgentEvent => ({ type: 'cart_update', data: { cart } }),

  changeUpdate: (change: Record<string, unknown>): AgentEvent => ({ type: 'change_update', data: { change } }),

  progress(message: string, tool?: string, step?: number): AgentEvent {
    const data: Record<string, unknown> = { message };
    if (tool) data.tool = tool;
    if (step !== undefined) data.step = step;
    return { type: 'progress', data };
  },

  turnComplete: (stopReason: string | null, usage: Record<string, number>, elapsedMs: number, resultsCleared: number): AgentEvent => ({
    type: 'turn_complete',
    data: { stop_reason: stopReason, usage, elapsed_ms: elapsedMs, results_cleared: resultsCleared },
  }),

  error: (message: string): AgentEvent => ({ type: 'error', data: { message } }),
} as const;

/** One tool call's product: `resultText` for the model, `events` for the host. `blocked` names the gate that held the call; `isError` marks a failure. A held call is a NORMAL result with a status, not an error: the model is told which rule stopped it and what to do instead, and the turn continues. */
export interface ToolOutcome {
  resultText: string;
  events: AgentEvent[];
  isError: boolean;
  blocked?: string;
}

export const ToolOutcomes = {
  ok: (resultText: string, events: AgentEvent[] = []): ToolOutcome => ({ resultText, events, isError: false }),
  error: (text: string): ToolOutcome => ({ resultText: text, events: [], isError: true }),
  held: (gate: string, text: string): ToolOutcome => ({ resultText: text, events: [], isError: false, blocked: gate }),
} as const;

export function isRefused(outcome: ToolOutcome): boolean {
  return outcome.isError || outcome.blocked !== undefined;
}

/** One Server-Sent Events frame: `event:` is the event type, `data:` its JSON payload on one line, then a blank line. `components/assistant/protocol.ts` reads it. (JSON.stringify never emits a raw newline, so the frame cannot be split by model text.) */
export function toSse(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** `text` cut back to before the string that opens at `opened`: over the key and colon when the string is a value, and over the comma that introduced it. */
function beforeOpenString(text: string, opened: number): string {
  let head = text.slice(0, opened).trimEnd();
  if (head.endsWith(':')) {
    head = head.slice(0, -1).trimEnd();
    if (head.endsWith('"')) {
      let index = head.length - 2;
      while (index > 0 && !(head[index] === '"' && head[index - 1] !== '\\')) index -= 1;
      head = head.slice(0, index).trimEnd();
    }
  }
  if (head.endsWith(',')) head = head.slice(0, -1);
  return head;
}

function closersFor(source: string): { closing: string; inString: boolean; opened: number } {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let opened = -1;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      opened = index;
    } else if (char === '{' || char === '[') stack.push(char);
    else if ((char === '}' || char === ']') && stack.length > 0) stack.pop();
  }
  const closing = [...stack].reverse().map((open) => (open === '[' ? ']' : '}')).join('');
  return { closing, inString, opened };
}

function tryObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The object a still-arriving tool input describes so far, or null. Open arrays and objects are closed; a dangling comma or colon is
 * dropped and closing tried again. A string still being written is left out together with its key (or its array slot), so a title, a
 * label or an id appears only once complete: a half-written title rendered then corrected is a visible flicker, and a half-written id is
 * a card that briefly points at the wrong product. With `settleStrings: false` it is closed where it stands instead, so text grows as it
 * generates.
 *
 * Hand-ported on purpose: SDK tolerant parsers close an open string where it stands, which is the behaviour this exists to avoid.
 */
export function parsePartialJson(buffer: string, settleStrings = true): Record<string, unknown> | null {
  let text = buffer.trim();
  if (!text.startsWith('{')) return null;
  const whole = tryObject(text);
  if (whole) return whole;

  const candidates: string[] = [];
  let { closing, inString, opened } = closersFor(text);
  if (inString && settleStrings) {
    text = beforeOpenString(text, opened);
    ({ closing, inString, opened } = closersFor(text));
  }
  candidates.push(text + (inString ? '"' : '') + closing);
  let trimmed = text.trimEnd();
  while (trimmed.length > 0 && (trimmed.endsWith(',') || trimmed.endsWith(':'))) trimmed = trimmed.slice(0, -1).trimEnd();
  if (trimmed !== text) {
    ({ closing, inString, opened } = closersFor(trimmed));
    candidates.push(trimmed + (inString ? '"' : '') + closing);
  }
  for (const candidate of candidates) {
    const parsed = tryObject(candidate);
    if (parsed) return parsed;
  }
  return null;
}

/** Strict parse of a COMPLETE streamed tool input; null when it is not a JSON object. Never use the SDK's tolerant `.input` to dispatch a write: a cart write on a half-written object is a write with the wrong quantity. */
export function parseStrictObject(raw: string): Record<string, unknown> | null {
  return tryObject(raw.trim() === '' ? '{}' : raw);
}
