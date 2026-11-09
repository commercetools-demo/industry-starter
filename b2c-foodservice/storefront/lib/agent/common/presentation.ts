// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/presentation.py; changes: TypeScript port; validation is a `parse` function the role supplies (zod lives in shopping/tools/presentation.ts, not here); enrichment context is generic instead of `Any`.

import type { ToolDefinition } from './execution';
import { sanitizeSuggestionChips } from './fencing';
import { AgentEvents, type ToolOutcome, ToolOutcomes } from './streaming';

/**
 * Presentation tools: the component spec the built-ins and deployment extensions share, and the one runner that validates a call,
 * enriches it, and produces its `ui` event. The model selects and annotates; every fact on the component is joined server-side from
 * records a tool returned this session.
 */

/** The one component that carries the turn's chips. */
export const CHIPS_TOOL = 'present_suggestions';
export const CHIPS_COMPONENT = 'suggestions';

/** Thrown by an enrich hook when the call cannot render. `gate` names the gate that held it (the result is then a held call); without a gate the result is an error. The message goes back to the model, which retries: that retry loop is a safety rule. */
export class PresentationRefused extends Error {
  constructor(
    message: string,
    readonly gate?: string,
  ) {
    super(message);
    this.name = 'PresentationRefused';
  }
}

/** Thrown by a payload `parse` function. The message is what the model reads, so keep it readable. */
export class PayloadInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadInvalid';
  }
}

/** What an enrich hook works with. A hook appends to `notes` anything the model should hear about the call (ids it dropped, text it removed). */
export interface EnrichmentContext<Backend = unknown, Config = unknown, Session = unknown, State = unknown> {
  backend: Backend;
  config: Config;
  session: Session;
  state: State;
  notes: string[];
}

export type EnrichFn<P, Ctx> = (payload: P, context: Ctx) => Promise<Record<string, unknown>>;
/** Runs on every structural change of a still-streaming call: synchronous, cheap and provenance-only. Gets the tolerantly parsed prefix and the session state; returns the partial payload, or null while nothing is renderable. */
export type PartialEnrichFn<State = unknown> = (data: Record<string, unknown>, state: State) => Record<string, unknown> | null;

/** One presentation tool: the `component` the host renders, the `parse` that validates the model's arguments, and the hooks that join server data onto it. Without `enrich` the validated payload renders as sent. */
export interface PresentationComponent<P = unknown, Ctx extends EnrichmentContext = EnrichmentContext, State = unknown> {
  readonly name: string;
  readonly component: string;
  /** Validates the model's arguments; throws `PayloadInvalid`. Undeclared keys are dropped, not rejected: a stray `status` line is not worth a rejected card. */
  readonly parse: (input: Record<string, unknown>) => P;
  readonly enrich?: EnrichFn<P, Ctx>;
  readonly enrichPartial?: PartialEnrichFn<State>;
}

/** A deployment-supplied component, merged into the tool surface at construction (APPENDED after the built-ins). `inputSchema` is what the model sees and must describe the shape `parse` validates. An enrich hook refuses by throwing `PresentationRefused`. */
export interface PresentationExtension<P = unknown, Ctx extends EnrichmentContext = EnrichmentContext, State = unknown> extends PresentationComponent<P, Ctx, State> {
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  toolDefinition(): ToolDefinition;
}

/** How a payload that failed validation is reported to the model; the validator's message follows it. */
export function invalidPayloadPrefix(toolName: string): string {
  return `Invalid ${toolName} payload:`;
}

/** The turn's chips: sanitized here because the tool schemas are cache-frozen, and refused when every chip sanitizes away, since the chips are its whole content. */
export function parseSuggestions(input: Record<string, unknown>): { suggestions: string[] } {
  const raw = input.suggestions;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 4 || !raw.every((c) => typeof c === 'string')) {
    throw new PayloadInvalid('suggestions: send 1-4 short, plain-text suggestions.');
  }
  const suggestions = sanitizeSuggestionChips(raw as string[]);
  if (suggestions.length === 0) throw new PayloadInvalid('every suggestion was empty after sanitization — send 1-4 short, plain-text suggestions.');
  return { suggestions };
}

/** Validate, enrich and emit one component. The result text is `displayedText` plus the hook's notes; the `ui` event carries the enriched payload. */
export async function runPresentation<P, Ctx extends EnrichmentContext>(
  spec: PresentationComponent<P, Ctx, never>,
  toolInput: Record<string, unknown>,
  context: Ctx,
  displayedText: string,
): Promise<ToolOutcome> {
  let payload: P;
  try {
    payload = spec.parse(toolInput);
  } catch (error) {
    if (error instanceof PayloadInvalid) return ToolOutcomes.error(`${invalidPayloadPrefix(spec.name)} ${error.message}`);
    throw error;
  }
  let enriched: Record<string, unknown>;
  if (!spec.enrich) {
    enriched = dropUndefined(payload as Record<string, unknown>);
  } else {
    try {
      enriched = await spec.enrich(payload, context);
    } catch (error) {
      if (error instanceof PresentationRefused) return error.gate === undefined ? ToolOutcomes.error(error.message) : ToolOutcomes.held(error.gate, error.message);
      throw error;
    }
  }
  const text = [displayedText, ...context.notes].join(' ');
  return ToolOutcomes.ok(text, [AgentEvents.ui(spec.component, enriched)]);
}

function dropUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null));
}

/** What counts as a visible change while a component streams: a title appearing, and the length of every list on the payload, or of each entry's `products` list when the entries carry one. */
export function partialSignature(payload: Record<string, unknown>): { hasTitle: boolean; lists: Record<string, number | number[]> } {
  const lists: Record<string, number | number[]> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!Array.isArray(value)) continue;
    const carriesProducts = value.length > 0 && value.every((item) => item !== null && typeof item === 'object' && 'products' in (item as object));
    lists[key] = carriesProducts ? value.map((item) => ((item as { products?: unknown[] }).products ?? []).length) : value.length;
  }
  return { hasTitle: Boolean(payload.title), lists };
}

/** The tools whose calls the orchestrator renders progressively. */
export function partialUiToolNames(components: Iterable<{ readonly name: string; readonly enrichPartial?: unknown }>): ReadonlySet<string> {
  return new Set([...components].filter((c) => c.enrichPartial !== undefined).map((c) => c.name));
}

/** A still-streaming call's partial payload with its change signature, or null. A payload with no title whose lists are all still empty is not a frame yet. */
export function enrichPartial<State>(spec: PresentationComponent<never, never, State>, data: Record<string, unknown>, state: State): { component: string; payload: Record<string, unknown>; signature: string } | null {
  if (!spec.enrichPartial) return null;
  const payload = spec.enrichPartial(data, state);
  if (payload === null) return null;
  const signature = partialSignature(payload);
  const counts = Object.values(signature.lists).flat();
  if (!signature.hasTitle && Object.keys(signature.lists).length > 0 && !counts.some((n) => n > 0)) return null;
  return { component: spec.component, payload, signature: JSON.stringify(signature) };
}
