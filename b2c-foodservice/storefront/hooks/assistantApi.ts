// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/web-shared/api.ts; changes: same-origin cookie session (no session header), reads answer null on failure, the chat response is read by content type (event stream or buffered JSON), no memory or orders reads.

import type { AgentEvent } from '@/components/assistant/protocol';
import { ApiError, fetchJson } from '@/hooks/fetcher';

/** The assistant's HTTP surface. The session lives in the signed cookie: nothing here carries an id, a price or a history. */
export const assistantApi = {
  /** Starts (or keeps) the session. Resolves false when the assistant is off or unavailable. */
  async startSession(): Promise<boolean> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetchJson<{ ok: true }>('/api/assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timezone ? { timezone } : {}),
      });
      return true;
    } catch {
      return false;
    }
  },

  /** Throws when the request itself fails. The branch is by content type: an event stream, or the buffered `{ events }` answer. */
  async *chatStream(message: string): AsyncGenerator<AgentEvent> {
    const response = await fetch('/api/assistant/turn', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok || !response.body) throw new ApiError('upstream_unavailable', response.status);
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const data = (await response.json()) as { events?: AgentEvent[] };
      for (const event of data.events ?? []) yield event;
      return;
    }
    yield* readEventStream(response.body);
  },

  /** The cart as the card shows it, or null (held, capped out, or failed). */
  async cardAdd(id: string, quantity: number): Promise<Record<string, unknown> | null> {
    try {
      const data = await fetchJson<{ cart: Record<string, unknown> }>('/api/assistant/card/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity }),
      });
      return data.cart;
    } catch {
      return null;
    }
  },

  async cardProduct(id: string): Promise<{ product: Record<string, unknown>; variants: Record<string, unknown>[] } | null> {
    try {
      return await fetchJson(`/api/assistant/card/product?id=${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },
};

async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType: string | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trimEnd();
      buffer = buffer.slice(newline + 1);
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventType) {
        try {
          yield { type: eventType, data: JSON.parse(line.slice(6)) } as AgentEvent;
        } catch {
          // A malformed frame is dropped; the stream continues.
        }
      } else if (line === '') {
        eventType = null;
      }
    }
  }
}
