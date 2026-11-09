import { describe, expect, it } from 'vitest';
import { MemorySessionStore } from '../store/memory-store';
import { cleanMessage, contextFor, isAgentSessionId, resolveSession, startSession } from './sessions';

const principal = { userId: 'anon-1', anonymousId: 'anon-1', country: 'US', locale: 'en-US', currency: 'USD' };

describe('assistant sessions', () => {
  it('creates an unguessable id and resolves it for the same principal only', async () => {
    const store = new MemorySessionStore({});
    const s = await startSession(store, principal);
    expect(isAgentSessionId(s.id)).toBe(true);
    expect(await resolveSession(store, s.id, principal)).not.toBeNull();
    expect(await resolveSession(store, s.id, { ...principal, userId: 'cust-9' })).toBeNull();
    // a mismatch ends the session
    expect(await resolveSession(store, s.id, principal)).toBeNull();
  });

  it('ends a session when the market changed', async () => {
    const store = new MemorySessionStore({});
    const s = await startSession(store, principal);
    expect(await resolveSession(store, s.id, { ...principal, country: 'CA', locale: 'en-CA', currency: 'CAD' })).toBeNull();
    expect(await store.get(s.id)).toBeNull();
  });

  it('refuses malformed ids without touching the store', async () => {
    const store = new MemorySessionStore({});
    expect(await resolveSession(store, 'nope', principal)).toBeNull();
    expect(await resolveSession(store, undefined, principal)).toBeNull();
  });

  it('builds the context from the principal and omits absent fields', async () => {
    const store = new MemorySessionStore({});
    const ctx = contextFor(await startSession(store, principal));
    expect(ctx.customerId).toBeUndefined();
    expect(ctx.currency).toBe('USD');
    expect(ctx.page.pageType).toBe('other');
  });

  it('cleans the message', () => {
    expect(cleanMessage('  hi ')).toBe('hi');
    expect(cleanMessage('   ')).toBeNull();
    expect(cleanMessage('x'.repeat(2001))).toBeNull();
    expect(cleanMessage(5)).toBeNull();
  });
});
