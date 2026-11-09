// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontApiBackend } from '@/lib/ct/assistant-backend';
import type { Session } from '@/lib/session';

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMarket: vi.fn(),
  resolve: vi.fn(),
  createAgent: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/session')>();
  return { ...real, getSession: m.getSession, getMarket: m.getMarket };
});
vi.mock('@/lib/agent/http/guard', () => ({
  guardAssistant: () => null,
  assistantConfigured: () => true,
  unavailable: () => new Response(null, { status: 503 }),
}));
vi.mock('@/lib/agent/host/sessions', () => ({
  cleanMessage: (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  resolveSession: m.resolve,
  runTurn: async function* () {
    // no events: the test reads the backend the route built
  },
}));
vi.mock('@/lib/agent/service', () => ({
  assistantConfig: () => ({ provenanceCap: 60 }),
  createAssistantAgent: m.createAgent,
}));
vi.mock('@/lib/agent/store', () => ({ getSessionStore: () => ({}) }));
vi.mock('@/lib/ct/cart', () => ({ LineRejected: class extends Error {} }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: {} }));

import { POST } from './route';

const shopper: Session = {
  customerId: 'c-1',
  customerFirstName: 'Maya',
  cartId: 'bag-1',
  agentSessionId: 'agent-1',
  country: 'US',
  currency: 'USD',
  locale: 'en-CA',
};

beforeEach(() => {
  process.env.ASSISTANT_TRANSPORT = 'buffered';
  m.getSession.mockResolvedValue(shopper);
  m.getMarket.mockResolvedValue({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
  m.resolve.mockResolvedValue({ session: { id: 'agent-1' }, version: 'v1' });
  m.createAgent.mockReset();
});

describe('POST /api/assistant/turn builds its backend from the cookie session', () => {
  it('The backend holds the shopper session and the market, not the stored record', async () => {
    const ctx = { params: Promise.resolve({}) };
    const res = await POST(new Request('http://localhost/api/assistant/turn', { method: 'POST', body: JSON.stringify({ message: 'hi' }), headers: { 'content-type': 'application/json' } }), ctx);
    expect(res.status).toBe(200);
    expect(m.createAgent).toHaveBeenCalledTimes(1);
    const backend = m.createAgent.mock.calls[0]?.[0] as unknown;
    expect(backend).toBeInstanceOf(StorefrontApiBackend);
    const held = (backend as { session: Session; market: { currency: string } });
    expect(held.session.cartId).toBe('bag-1');
    expect(held.session.customerId).toBe('c-1');
    expect(held.market.currency).toBe('CAD');
  });
});
