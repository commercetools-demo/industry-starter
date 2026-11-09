// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/runtime-messages-api/shopping_agent_runtime/orchestrator.py; changes: TypeScript async generator over the raw event stream; turn wall-clock deadline checked between rounds; AbortSignal replaces task cancellation; the session is persisted by the host through `beforeComplete` (immediately before turn_complete); no memory extraction (a serverless function is frozen when its body ends, and memory is off here).

import { firstForcedTool, groundingInstruction } from '../common/grounding';
import { buildSystemBlocks, buildRequestMessages, type Message, withEagerInput, withToolCacheControl } from '../common/prompt-assembly';
import { partialUiToolNames } from '../common/presentation';
import type { SkillRegistry } from '../common/skills';
import { type AgentEvent, AgentEvents, type ToolOutcome } from '../common/streaming';
import { supportsForcedToolChoice, thinkingRequestFields } from '../common/config';
import {
  EagerDispatcher,
  type RawEvent,
  StreamedRound,
  accumulateUsage,
  closeOpenToolUses,
  compactHistory,
  elapsedMs,
  fetched,
  latestUserText,
  logModelCall,
  outcomeEvents,
  promptTokens,
  roundClosesTurn,
  settleUnreadable,
  toolResultBlock,
  usageTotals,
} from '../common/turn';
import type { StorefrontBackend } from '../shopping/backend';
import type { ShoppingAgentConfig } from '../shopping/config';
import { PRESENTATION_COMPONENTS } from '../shopping/enrichment';
import { ShoppingToolExecutor } from '../shopping/executor';
import { GROUNDING_RULES } from '../shopping/grounding';
import { buildDynamicContext, buildStaticSystem } from '../shopping/prompt';
import { buildTools } from '../shopping/tools/registry';
import { type ShoppingSessionContext, type ShoppingSessionState, newSessionState } from '../shopping/types';

/**
 * The shopping agent's turn loop on the Messages API: one model call per iteration, tools dispatched eagerly as their blocks close,
 * presentation calls rendered while they stream, a rolling cache breakpoint through the conversation, and a round of clean presentation
 * calls that includes the chips ending the turn with no closing model call at all.
 */

/** The one thing the loop needs from a model: a streamed request. Production uses the Anthropic adapter; tests use a scripted fake. */
export interface ModelClient {
  stream(request: Record<string, unknown>, options: { signal?: AbortSignal }): Promise<AsyncIterable<RawEvent>>;
}

export interface ShoppingAgentOptions {
  backend: StorefrontBackend;
  skills: SkillRegistry;
  config: ShoppingAgentConfig;
  client: ModelClient;
}

export interface StreamTurnOptions {
  /** Aborted when the browser goes away; the backend honours it through the session context. */
  signal?: AbortSignal;
  /**
   * Awaited immediately BEFORE `turn_complete` is yielded: the host persists the session here (and rewrites the transcript whole when
   * `resultsCleared` is non-zero). That makes `turn_complete` the client's durability guarantee; a function killed at the host's ceiling has
   * written nothing, so the stored conversation is byte-identical to its pre-turn state; and a failed write surfaces as an error.
   */
  beforeComplete?: (info: { resultsCleared: number }) => Promise<void>;
}

export class ShoppingAgent {
  private readonly staticSystem: string;
  private readonly tools: ReturnType<typeof withToolCacheControl>;
  private readonly partialUiTools: ReadonlySet<string>;

  constructor(private readonly options: ShoppingAgentOptions) {
    const { config, skills } = options;
    this.partialUiTools = partialUiToolNames(PRESENTATION_COMPONENTS.values());
    // Built ONCE: the same bytes on every request of this deployment. The presentation tools that render while they stream ask the API for
    // their input as it is generated.
    this.staticSystem = buildStaticSystem(config, skills);
    this.tools = withToolCacheControl(withEagerInput(buildTools(config, skills.names), this.partialUiTools));
  }

  /**
   * Run one turn. `messages` ends with the user's message and is extended in place with the turn's assistant messages and tool results, so
   * the host stores it as is; `state` carries the session's provenance and comes back on every turn.
   *
   * Consume this INSIDE the response stream's start callback and call `.return()` on it when the browser goes away: that runs the `finally`
   * below, which pairs any open tool call with a result (otherwise the stored conversation ends on a tool call with no result and the API
   * rejects the NEXT request outright).
   */
  async *streamTurn(messages: Message[], sessionIn: ShoppingSessionContext, state: ShoppingSessionState = newSessionState(), options: StreamTurnOptions = {}): AsyncGenerator<AgentEvent> {
    const { backend, skills, config, client } = this.options;
    const turnStarted = performance.now();
    const turnAbort = new AbortController();
    const onOuterAbort = (): void => turnAbort.abort();
    if (options.signal?.aborted) turnAbort.abort();
    else options.signal?.addEventListener('abort', onOuterAbort, { once: true });
    const session: ShoppingSessionContext = { ...sessionIn, signal: turnAbort.signal };

    const usage = usageTotals();
    let stopReason: string | null = null;
    let lastPrompt = 0;
    // Outcomes of calls that finished but whose results are not yet in the conversation (the host may close the generator at a yield).
    let settled = new Map<string, ToolOutcome>();

    try {
      const [preferences, account, cart] = await Promise.all([
        fetched('get_preferences', backend.getPreferences(session)),
        fetched('get_account_context', backend.getAccountContext?.(session)),
        fetched('get_cart', config.enableCart ? backend.getCart(session) : null),
      ]);
      // The clock: an explicit `now`, else the real time in the session's validated zone; neither means NO local-time line.
      const now = session.now ?? (session.timezone ? new Date() : undefined);
      const context = buildDynamicContext({
        preferences,
        cart,
        page: session.page,
        now,
        timeZone: session.timezone,
        account: account ?? null,
        accountMaxChars: config.maxContextChars,
      });
      const forcedTool = firstForcedTool(GROUNDING_RULES, config, latestUserText(messages), state);
      // Some models reject a forced tool_choice with a 400: there the grounding rule rides in the per-turn context as an instruction and
      // the round runs with `auto` (the static prompt and the transcript are untouched, so no cached byte changes).
      const forceByChoice = forcedTool !== null && supportsForcedToolChoice(config.model);
      const groundedContext = forcedTool !== null && !forceByChoice ? `${context}\n\n${groundingInstruction(forcedTool)}` : context;
      const system = buildSystemBlocks(this.staticSystem, groundedContext);
      const executor = new ShoppingToolExecutor({ backend, config, skills, session, state });
      let groundingToolCalled = false;

      for (let roundIndex = 0; roundIndex <= config.maxToolIterations; roundIndex += 1) {
        // Iteration caps are a runaway guard, not a budget; the DEADLINE is what keeps a slow turn inside the host's ceiling: past it one
        // final round runs with tools disabled so the turn ends in prose rather than being severed (a severed turn loses its turn_complete).
        const pastDeadline = config.turnDeadlineS > 0 && performance.now() - turnStarted > config.turnDeadlineS * 1000;
        const forceText = roundIndex === config.maxToolIterations || pastDeadline;
        const toolChoice: Record<string, string> = forceText ? { type: 'none' } : roundIndex === 0 && forcedTool && forceByChoice ? { type: 'tool', name: forcedTool } : { type: 'auto' };

        // The rolling marker is skipped on non-auto rounds: tool_choice keys the cached messages span, so an entry written under a forced
        // round is unreadable by the auto rounds that follow.
        const requestMessages = buildRequestMessages(messages, { rollingBreakpoint: config.rollingConversationCache && toolChoice.type === 'auto' });
        const request: Record<string, unknown> = {
          model: config.model,
          max_tokens: config.maxTokens,
          system,
          tools: this.tools,
          tool_choice: toolChoice,
          messages: requestMessages,
          ...thinkingRequestFields(config),
        };
        const dispatcher = new EagerDispatcher((name, args) => executor.execute(name, args), config.eagerToolDispatch && !forceText);
        const round = new StreamedRound(PRESENTATION_COMPONENTS as never, this.partialUiTools, state, config.eagerPartialFrames);
        const callStarted = performance.now();
        const signal = AbortSignal.any([turnAbort.signal, AbortSignal.timeout(config.requestTimeoutS * 1000)]);

        const stream = await client.stream(request, { signal });
        for await (const event of round.relay(stream, dispatcher, (n, id, input) => executor.toolCallEvent(n, id, input))) yield event;

        const { reply, toolUses, unreadable } = round.finish();
        settleUnreadable(round, dispatcher, unreadable, session.sessionId, roundIndex);
        stopReason = round.stopReason ?? 'tool_use';
        accumulateUsage(usage, round.usage);
        lastPrompt = promptTokens(round.usage);
        logModelCall(config.model, round.stopReason, round.usage, callStarted, session.sessionId, roundIndex);
        if (reply) messages.push(reply);
        if (forcedTool && toolUses.some((block) => block.name === forcedTool)) groundingToolCalled = true;
        if (toolUses.length === 0 || forceText) break;

        // The calls eager dispatch did not announce: started late, or never run.
        for (const block of toolUses) {
          if (unreadable.has(block.id) || !dispatcher.started(block.id)) yield executor.toolCallEvent(block.name, block.id, block.input);
        }
        const outcomes = await dispatcher.collect(toolUses);
        const calls = toolUses.map((block, i) => [block, outcomes[i]] as const);
        settled = new Map(calls.map(([block, outcome]) => [block.id, outcome]));
        for (const [block, outcome] of calls) for (const event of outcomeEvents(block.name, block.id, outcome)) yield event;
        messages.push({ role: 'user', content: calls.map(([block, outcome]) => toolResultBlock(block.id, outcome)) });
        settled = new Map();
        if (config.closeOnPresentation && roundClosesTurn(calls.map(([block, outcome]) => [block.name, outcome] as const), (n, o) => executor.endsClean(n, o))) {
          stopReason = 'end_turn';
          break;
        }
      }
      // Instruction-only grounding is not enforced by the API: say when a grounded turn ended without its read (tool name only).
      if (forcedTool && !forceByChoice && !groundingToolCalled) console.warn(JSON.stringify({ event: 'assistant_grounding_skipped', tool: forcedTool }));
    } finally {
      // Pairs any open tool call with its result, or an error naming the interruption; then cancels whatever is still running.
      closeOpenToolUses(messages, settled);
      options.signal?.removeEventListener('abort', onOuterAbort);
      turnAbort.abort();
    }

    const cleared = compactHistory(messages, lastPrompt, config.compactHistoryAboveTokens, session.sessionId);
    await options.beforeComplete?.({ resultsCleared: cleared });
    yield AgentEvents.turnComplete(stopReason, usage as unknown as Record<string, number>, elapsedMs(turnStarted), cleared);
  }
}
