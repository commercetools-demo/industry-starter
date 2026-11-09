import { randomBytes } from 'node:crypto';
import type { Message } from '../common/prompt-assembly';
import { type AgentEvent, AgentEvents } from '../common/streaming';
import { rememberProducts, type Product, type ShoppingSessionContext, type ShoppingSessionState, newSessionState } from '../shopping/types';
import { type LoadedSession, type Principal, type SessionStore, type StoredSession, VersionConflict } from '../store/session-store';
import type { ShoppingAgent } from '../runtime/orchestrator';

/** Session lifecycle for the assistant (T-25/T-26): create, resolve against the signed principal, run a turn and persist it. No `lib/ct`, no Next. */

export function newAgentSessionId(): string {
  return randomBytes(32).toString('base64url');
}

const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export function isAgentSessionId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export async function startSession(store: SessionStore, principal: Principal, now = new Date()): Promise<StoredSession> {
  const session: StoredSession = { id: newAgentSessionId(), principal, provenance: [], messages: [], createdAt: now.toISOString() };
  await store.create(session);
  return session;
}

/**
 * The stored session for `id`, only when it belongs to `principal` (same user and market). A session for somebody else, or for another
 * market, is ended and reads as absent: the caller starts a fresh one. The principal comes from the signed cookie, never a body.
 */
export async function resolveSession(store: SessionStore, id: string | undefined, principal: Principal): Promise<LoadedSession | null> {
  if (!isAgentSessionId(id)) return null;
  const loaded = await store.get(id);
  if (!loaded) return null;
  const p = loaded.session.principal;
  if (p.userId !== principal.userId || p.country !== principal.country || p.locale !== principal.locale) {
    await store.delete(id);
    return null;
  }
  return loaded;
}

export function contextFor(stored: StoredSession): ShoppingSessionContext {
  const p = stored.principal;
  return {
    sessionId: stored.id,
    userId: p.userId,
    page: { pageType: 'other', extra: {} },
    ...(p.customerId ? { customerId: p.customerId } : {}),
    ...(p.anonymousId ? { anonymousId: p.anonymousId } : {}),
    ...(p.country ? { country: p.country } : {}),
    ...(p.locale ? { locale: p.locale } : {}),
    ...(p.currency ? { currency: p.currency } : {}),
    ...(p.timezone ? { timezone: p.timezone } : {}),
  };
}

export function stateOf(stored: StoredSession, cap: number): ShoppingSessionState {
  const state = newSessionState();
  rememberProducts(state, stored.provenance.map(([, product]) => product) as Product[], cap);
  return state;
}

const MAX_MESSAGE_CHARS = 2000;
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text.length === 0 || text.length > MAX_MESSAGE_CHARS ? null : text;
}

export interface RunTurnOptions {
  store: SessionStore;
  loaded: LoadedSession;
  agent: ShoppingAgent;
  message: string;
  provenanceCap: number;
  signal?: AbortSignal;
}

/**
 * One turn over a stored session. The transcript and provenance are saved (compare-and-set) immediately before `turn_complete`; a lost
 * race answers an error event and writes nothing, so the stored conversation stays exactly what it was.
 */
export async function* runTurn(options: RunTurnOptions): AsyncGenerator<AgentEvent> {
  const { store, loaded, agent, message, provenanceCap, signal } = options;
  const stored = loaded.session;
  const messages: Message[] = [...stored.messages, { role: 'user', content: message }];
  const state = stateOf(stored, provenanceCap);
  let version = loaded.version;
  try {
    yield* agent.streamTurn(messages, contextFor(stored), state, {
      ...(signal ? { signal } : {}),
      beforeComplete: async () => {
        const next: StoredSession = { ...stored, messages, provenance: [...state.seenProducts.entries()] };
        version = await store.save(next, version);
      },
    });
  } catch (error) {
    if (error instanceof VersionConflict) {
      yield AgentEvents.error('Another request changed this conversation. Please try again.');
      return;
    }
    throw error;
  }
}
