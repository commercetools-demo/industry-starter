// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/execution.py; changes: TypeScript port; delegates and memory runtime not ported (memory tools answer a fixed disabled text); handler table built lazily; clampLimit and status helpers unchanged in behaviour.

import { type Fence, sanitizeLabel } from './fencing';
import { type EnrichmentContext, type PresentationComponent, runPresentation } from './presentation';
import type { SkillRegistry } from './skills';
import { AgentEvents, type AgentEvent, type ToolOutcome, ToolOutcomes, isRefused } from './streaming';

/** A tool definition as sent to the Messages API: `{name, description, input_schema}` (key order is prompt bytes), or a server tool. */
export type ToolDefinition = Record<string, unknown> & { name: string };

export const LOAD_SKILL = 'load_skill';
export const STATUS_FIELD = 'status';
export const STATUS_MAX_CHARS = 60;

interface ObjectSchema extends Record<string, unknown> {
  properties?: Record<string, unknown>;
}

/**
 * `tool` with `status` as its first property, optional; `reader` is who sees the line ("the customer", "the operator"). FIRST matters:
 * key order in the tool JSON is prompt bytes. The line is the few words the person waiting sees while the call runs; it is split off
 * before validation, gates and handlers and never reaches a backend.
 */
export function withStatus(tool: ToolDefinition, reader: string): ToolDefinition {
  const original = tool.input_schema as ObjectSchema;
  const status = {
    type: 'string',
    maxLength: STATUS_MAX_CHARS,
    description: `A few plain words ${reader} sees while this runs, saying what you are doing for them; no tool or system names.`,
  };
  // Replacing an existing key keeps its position, so `properties` stays where it was in the schema.
  const schema: ObjectSchema = { ...original, properties: { [STATUS_FIELD]: status, ...(original.properties ?? {}) } };
  return { ...tool, input_schema: schema };
}

/** `tool` with the `status` property left out, for a caller whose line nobody sees. */
export function withoutStatus(tool: ToolDefinition): ToolDefinition {
  const original = tool.input_schema as ObjectSchema;
  const properties = Object.fromEntries(Object.entries(original.properties ?? {}).filter(([key]) => key !== STATUS_FIELD));
  return { ...tool, input_schema: { ...original, properties } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The executor frame both roles extend. A role executor supplies its fence, its handler table and its wording; this frame owns dispatch,
// the failure ladder, skills, presentation, and the `status` line a non-presentation call may carry for the person waiting, so every tool
// result is built in one place and every path calls `execute`. `execute` never throws.
// ---------------------------------------------------------------------------------------------------------------------------------

export type Handler = (toolInput: Record<string, unknown>) => Promise<ToolOutcome>;

/** What a memory tool answers while a deployment has memory switched off. Memory is not ported here: the tools stay registered (no prompt-byte change) and always answer this. */
export const MEMORY_DISABLED_TEXT = 'Memory is not enabled for this deployment.';

/** A tool argument failed its schema; `execute` answers by naming the fields. Only a failure raised by `parseArgument` is reported as bad arguments: a validation error from anywhere else in a handler is a backend failure like any other. */
export class InvalidArguments extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArguments';
  }
}

/** A model-supplied count clamped to `1..ceiling`; missing or zero means `fallback`. */
export function clampLimit(raw: unknown, fallback: number, ceiling: number): number {
  const n = Math.trunc(Number(raw) || fallback);
  return Math.max(1, Math.min(n, ceiling));
}

export function invalidArgumentsText(name: string, issues: string): string {
  return `${name} arguments were invalid — ${issues}. Adjust and call it again.`;
}

export interface ExecutorConfig {
  maxFencedChars: number;
  maxSearchResults: number;
}

export interface ExecutorOptions<Backend, Config, Session, State> {
  backend: Backend;
  config: Config;
  /** Tool names the deployment's config leaves out of the tool list: refused here whichever path calls, so a model that guesses a name cannot reach a system the deployment removed. */
  absent: ReadonlySet<string>;
  skills: SkillRegistry;
  session: Session;
  state: State;
}

export abstract class BaseToolExecutor<Backend, Config extends ExecutorConfig, Session, State> {
  abstract readonly fence: Fence;
  abstract readonly components: ReadonlyMap<string, PresentationComponent<unknown, EnrichmentContext<Backend, Config, Session, State>, State>>;
  abstract readonly displayedText: string;
  /** Formatted with {name}. */
  abstract readonly unavailableText: string;
  /** A tool the config switches off: the system does not exist here, which is not an outage. Formatted with {name}. */
  readonly absentText: string = '{name} is not something offered here; say so plainly and do not suggest it.';

  protected readonly backend: Backend;
  protected readonly config: Config;
  protected readonly session: Session;
  protected readonly state: State;
  private readonly absent: ReadonlySet<string>;
  private readonly skills: SkillRegistry;
  private table?: Record<string, Handler>;

  constructor(options: ExecutorOptions<Backend, Config, Session, State>) {
    this.backend = options.backend;
    this.config = options.config;
    this.absent = options.absent;
    this.skills = options.skills;
    this.session = options.session;
    this.state = options.state;
  }

  // -- role hooks
  /** The role's handlers, one per non-presentation tool. Built lazily on the first dispatch (a subclass's own fields are not set while the base constructor runs). */
  protected abstract handlers(): Record<string, Handler>;
  /** A role's own exception classes mapped to outcomes; null for the generic ladder. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected domainError(_error: unknown): ToolOutcome | null {
    return null;
  }
  /** One line per failed tool, TOOL NAME ONLY: arguments can carry catalogue text and the session's own data. */
  protected logFailure(name: string): void {
    console.warn(JSON.stringify({ event: 'assistant_tool_failed', tool: name }));
  }

  // -- helpers for handlers
  protected sanitize(value: unknown, maxChars?: number): string {
    return this.fence.sanitizeText(String(value ?? ''), maxChars);
  }

  protected fenced(payload: unknown, events: readonly AgentEvent[] = []): ToolOutcome {
    return ToolOutcomes.ok(this.fence.fencePayload(payload, this.config.maxFencedChars), [...events]);
  }

  protected searchLimit(raw: unknown): number {
    return clampLimit(raw, this.config.maxSearchResults, this.config.maxSearchResults);
  }

  // -- dispatch
  /** True when `name` is a presentation tool. */
  presents(name: string): boolean {
    return this.components.has(name);
  }

  /** The call's arguments without the `status` line, and that line sanitized for the host (null on a presentation tool and on a call without the field). It is model display text and must never reach a backend, a gate, memory or a tool result, on any path. */
  splitStatus(name: string, toolInput: Record<string, unknown>): { args: Record<string, unknown>; status: string | null } {
    if (this.presents(name) || !(STATUS_FIELD in toolInput)) return { args: toolInput, status: null };
    const args = Object.fromEntries(Object.entries(toolInput).filter(([k]) => k !== STATUS_FIELD));
    // Fence markers out like any model string, then one-line label hygiene and the cap.
    const status = sanitizeLabel(this.sanitize(toolInput[STATUS_FIELD]), STATUS_MAX_CHARS);
    return { args, status: status || null };
  }

  /** The `tool_call` event for the host: the arguments the tool will get, and the status line beside them as its `label`. */
  toolCallEvent(name: string, toolUseId: string, toolInput: Record<string, unknown>): AgentEvent {
    const { args, status } = this.splitStatus(name, toolInput);
    return AgentEvents.toolCall(name, toolUseId, args, status ?? undefined);
  }

  /** True when a call may sit in the round that ends the turn without a closing model call: a presentation call that rendered and left the model nothing to answer (not refused or held, no note appended to its result). */
  endsClean(name: string, outcome: ToolOutcome): boolean {
    return this.presents(name) && !isRefused(outcome) && outcome.resultText === this.displayedText;
  }

  /** Never throws: a tool failure must not end the turn. */
  async execute(name: string, toolInput: Record<string, unknown> | null | undefined): Promise<ToolOutcome> {
    try {
      return await this.dispatch(name, { ...(toolInput ?? {}) });
    } catch (error) {
      if (error instanceof InvalidArguments) return ToolOutcomes.error(invalidArgumentsText(name, error.message));
      const mapped = this.domainError(error);
      if (mapped) return mapped;
      this.logFailure(name);
      return ToolOutcomes.error(this.unavailableText.replace('{name}', name));
    }
  }

  /** `execute` without the failure ladder: what the tool raised propagates. The `status` line is dropped here, before any argument is validated or any handler runs; a tool the config leaves out of the tool list is unknown here too, whichever path calls it. */
  async dispatch(name: string, toolInput: Record<string, unknown>): Promise<ToolOutcome> {
    const { args } = this.splitStatus(name, toolInput);
    if (this.absent.has(name)) return ToolOutcomes.error(this.absentText.replace('{name}', name));
    if (name === LOAD_SKILL) return this.loadSkill(args);
    const spec = this.components.get(name);
    if (spec) return this.present(spec, args);
    this.table ??= { ...this.handlers(), save_memory: async () => ToolOutcomes.ok(MEMORY_DISABLED_TEXT), recall_memories: async () => ToolOutcomes.ok(MEMORY_DISABLED_TEXT) };
    const handler = Object.hasOwn(this.table, name) ? this.table[name] : undefined;
    if (!handler) return ToolOutcomes.error(`Unknown tool: ${name}`);
    return handler(args);
  }

  private loadSkill(args: Record<string, unknown>): ToolOutcome {
    const skillName = String(args.skill_name ?? '');
    const body = this.skills.getInstructions(skillName);
    if (body === null) return ToolOutcomes.error(`No skill named '${skillName}'. Available: ${this.skills.names.join(', ')}`);
    return ToolOutcomes.ok(body);
  }

  private present(spec: PresentationComponent<unknown, EnrichmentContext<Backend, Config, Session, State>, State>, args: Record<string, unknown>): Promise<ToolOutcome> {
    const context: EnrichmentContext<Backend, Config, Session, State> = { backend: this.backend, config: this.config, session: this.session, state: this.state, notes: [] };
    return runPresentation(spec, args, context, this.displayedText);
  }
}
