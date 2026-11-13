import { handle, jsonError } from '@/lib/api';
import { toSse, type AgentEvent } from '@/lib/agent/common/streaming';
import { assistantConfigured, guardAssistant, unavailable } from '@/lib/agent/http/guard';
import { cleanMessage, resolveSession, runTurn } from '@/lib/agent/host/sessions';
import { assistantConfig, createAssistantAgent } from '@/lib/agent/service';
import { getSessionStore } from '@/lib/agent/store';
import { createStorefrontBackend } from '@/lib/ct/assistant-backend';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HEARTBEAT_MS = 10_000;
const buffered = (): boolean => process.env.ASSISTANT_TRANSPORT?.trim().toLowerCase() === 'buffered';

/**
 * POST /api/assistant/turn { message } -> text/event-stream of agent events (or one JSON `{ events }` when ASSISTANT_TRANSPORT=buffered).
 * The body carries the message ONLY: no history, no ids, no prices, no tool results; the transcript is server-owned.
 * 400 bad_request (empty or over-long message), 404 not_found (no session: call /session first), 429, 503 assistant_disabled|assistant_unavailable.
 */
export const POST = handle('/api/assistant/turn', async (req) => {
  const session = await getSession();
  const limited = guardAssistant(req, 'turn', session.agentSessionId ?? '');
  if (limited) return limited;
  if (!assistantConfigured()) return unavailable();

  const body: unknown = await req.json().catch(() => null);
  const message = cleanMessage(typeof body === 'object' && body !== null ? (body as Record<string, unknown>).message : undefined);
  if (message === null) return jsonError('bad_request', 400);

  const userId = session.customerId ?? session.anonymousId;
  if (!userId || !session.agentSessionId) return jsonError('not_found', 404);
  const store = getSessionStore();
  const loaded = await resolveSession(store, session.agentSessionId, {
    userId,
    ...(session.country ? { country: session.country } : {}),
    ...(session.locale ? { locale: session.locale } : {}),
  });
  if (!loaded) return jsonError('not_found', 404);

  const agent = createAssistantAgent(createStorefrontBackend(session, await getMarket()));
  const events = runTurn({
    store,
    loaded,
    agent,
    message,
    provenanceCap: assistantConfig().provenanceCap,
    signal: req.signal,
  });

  if (buffered()) {
    const collected: AgentEvent[] = [];
    for await (const event of events) collected.push(event);
    return Response.json({ events: collected });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          /* already closed */
        }
      }, HEARTBEAT_MS);
      try {
        for await (const event of events) {
          if (event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'error' || event.type === 'turn_complete') {
            assistantDebug('[assistant] turn event', event.type, JSON.stringify(event.data).slice(0, 400));
          }
          controller.enqueue(encoder.encode(toSse(event)));
        }
      } catch (error) {
        // Logged, never sent to the browser: a silent catch here hid the model API's 400 for days.
        const e = error as { name?: string; message?: string; status?: number };
        console.error(JSON.stringify({ event: 'assistant_turn_failed', name: e?.name, status: e?.status, message: String(e?.message ?? error).slice(0, 500) }));
        controller.enqueue(
          encoder.encode(
            toSse({
              type: 'error',
              data: {
                message: 'The assistant could not finish. Please try again.',
              },
            }),
          ),
        );
      } finally {
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          /* cancelled */
        }
      }
    },
    async cancel() {
      // The browser went away: closing the generator runs its `finally`, which pairs any open tool call with a result.
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
});

/** TEMPORARY debug (order lookup investigation): one string per line, because the dev log file cannot serialise objects. */
function assistantDebug(label: string, ...data: unknown[]): void {
  const line = `${label} ${data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')}`;
  console.debug(line);
}
