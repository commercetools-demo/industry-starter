import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { RawEvent } from './common/turn';
import type { ModelClient } from './runtime/orchestrator';

/**
 * The production `ModelClient`: the raw event stream of the Messages API. Deliberately NOT `messages.stream()`: its accumulator parses
 * each tool input through a tolerant parser and throws from inside the iterator on a malformed one, before the stop event. The turn loop
 * accumulates the round itself from the raw events and parses strictly.
 *
 * `maxRetries: 0`: a retried call can spend the host's whole 60 s ceiling; the per-call timeout is an AbortSignal the loop passes in.
 */
export function createAnthropicClient(apiKey: string): ModelClient {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return {
    async stream(request, { signal }) {
      // The loop sends request fields (adaptive thinking, eager input streaming) that are gated by model family in config.
      const stream = await client.messages.create({ ...request, stream: true } as never, { signal });
      return stream as unknown as AsyncIterable<RawEvent>;
    },
  };
}
