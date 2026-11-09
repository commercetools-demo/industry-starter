// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/config.py; changes: closed TypeScript interface instead of pydantic (an unknown or missing field fails at compile time); camelCase names; new non-prompt fields provenanceCap and turnDeadlineS for the serverless host ceiling; thinking fields gated on a model-family allowlist.

import { MAX_FENCED_CHARS } from './fencing';

export const DEFAULT_MEMORY_MODEL = 'claude-haiku-5-5';

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * The config fields both roles share, in the section order the role configs continue: identity, models, budgets, capabilities,
 * memory, caps. Fields marked (prompt) render into the static prompt or the tool list, so they are constant within a deployment;
 * the rest steer the runtimes only and never change prompt bytes.
 *
 * Upstream forbids unknown field names at construction. Here the interface is closed and every deployment value is written as a
 * complete object literal typed with the role config (see `shopping/config.ts`), so a misspelled, missing or retired field fails
 * `tsc`, which is a deploy gate.
 */
export interface BaseAgentConfig {
  // -- Identity (prompt)
  brandName: string;
  assistantName: string;
  brandVoice: string;

  // -- Models: the turn loop runs on `model`, post-turn extraction on `memoryModel`. `thinkingEffort` null sends thinking disabled.
  model: string;
  memoryModel: string;
  thinkingEffort: ThinkingEffort | null;

  // -- Budgets. The iteration cap is a runaway guard: a multi-part request has to finish well inside it, because once the cap forces a
  // tool-less round the model tends to describe steps it never performed.
  maxTokens: number;
  maxToolIterations: number;
  requestTimeoutS: number;
  /** Wall-clock deadline for a whole turn, checked between rounds; past it one final round runs with tools disabled. 0 disables. New (serverless host ceiling). */
  turnDeadlineS: number;

  // -- Latency. Each turns off on its own, so a latency problem can be bisected.
  eagerToolDispatch: boolean;
  rollingConversationCache: boolean;
  eagerPartialFrames: boolean;
  closeOnPresentation: boolean;

  // -- Capabilities. Web search adds a tool (prompt); the memory tools stay registered either way and `enableMemory` switches their behaviour.
  enableWebSearch: boolean;
  enableMemory: boolean;

  // -- Memory
  memoryTierOneCap: number;
  memoryBlockedPatterns: readonly string[];
  memoryRetentionDays: number | null;

  // -- Caps: the backend's per-request context payload (replaced by a note when over), search results per call (the model's limit is
  // clamped to it), characters per fenced tool result, the prompt size at which a turn ends by clearing the oldest tool results.
  maxContextChars: number;
  maxSearchResults: number;
  maxFencedChars: number;
  compactHistoryAboveTokens: number;
  /** Records a provenance map keeps (the newest). New: upstream's constant 200 is rewritten every turn, too large for a serverless store. */
  provenanceCap: number;
}

/** Names the role's `buildTools` leaves out for systems the deployment switches off; the executor refuses them too. A role config lists its own. */
export type AbsentTools = (config: BaseAgentConfig) => ReadonlySet<string>;

export const BASE_DEFAULTS: Omit<BaseAgentConfig, 'model'> = {
  brandName: 'the store',
  assistantName: 'the assistant',
  brandVoice: 'plain and specific',
  memoryModel: DEFAULT_MEMORY_MODEL,
  thinkingEffort: null,
  maxTokens: 2048,
  maxToolIterations: 8,
  requestTimeoutS: 120,
  turnDeadlineS: 0,
  eagerToolDispatch: true,
  rollingConversationCache: true,
  eagerPartialFrames: false,
  closeOnPresentation: true,
  enableWebSearch: false,
  enableMemory: true,
  memoryTierOneCap: 8,
  memoryBlockedPatterns: [],
  memoryRetentionDays: null,
  maxContextChars: 2000,
  maxSearchResults: 8,
  maxFencedChars: MAX_FENCED_CHARS,
  compactHistoryAboveTokens: 100_000,
  provenanceCap: 200,
};

/**
 * Model families that accept the `thinking` and `output_config.effort` request fields. TRAP: the model id is a deployment setting
 * while these fields are static. For an id that matches no family the fields are NOT sent: omitting them costs some quality on hard
 * turns, while sending them to a model that rejects them is a 400 on every turn, which from outside looks exactly like a bad API key.
 * Verify an addition against the Claude API model documentation before extending this list.
 */
export const THINKING_MODEL_FAMILIES: readonly string[] = ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'];

export function supportsAdaptiveThinking(model: string): boolean {
  return THINKING_MODEL_FAMILIES.some((family) => model === family || model.startsWith(`${family}-`));
}

/** The request fields that carry `thinkingEffort`, for every model call the agent makes on `model`. Empty for an unrecognised model. */
export function thinkingRequestFields(config: Pick<BaseAgentConfig, 'model' | 'thinkingEffort'>): Record<string, unknown> {
  if (!supportsAdaptiveThinking(config.model)) return {};
  if (config.thinkingEffort === null) return { thinking: { type: 'disabled' } };
  return { thinking: { type: 'adaptive' }, output_config: { effort: config.thinkingEffort } };
}
