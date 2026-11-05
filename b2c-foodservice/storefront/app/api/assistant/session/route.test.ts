// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMarket: vi.fn(),
  resolve: vi.fn(),
  start: vi.fn(),
  cartFor: vi.fn(),
  createCart: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...real,
    getSession: m.getSession,
    getMarket: m.getMarket,
    // The token is the readable session, so a test can see what the cookie carries.
    createSessionToken: vi.fn(async (s: Session) => JSON.stringify(s)),
  };
});
vi.mock('@/lib/agent/http/guard', () => ({ guardAssistant: () => null }));
vi.mock('@/lib/agent/host/sessions', () => ({ resolveSession: m.resolve, startSession: m.start }));
vi.mock('@/lib/agent/store', () => ({ getSessionStore: () => ({}) }));
vi.mock('@/lib/ct/cart', () => ({ getCartForSession: m.cartFor, createCart: m.createCart }));

import { SESSION_COOKIE } from '@/lib/session';
import { POST } from './route';

const guest = { anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' };
const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const ctx = { params: Promise.resolve({}) };
const post = () => POST(new Request('http://localhost/api/assistant/session', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), ctx);
const cookieOf = (res: Response): Session | undefined => {
  const header = res.headers.get('set-cookie') ?? '';
  const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(header);
  return match ? (JSON.parse(decodeURIComponent(match[1] ?? '')) as Session) : undefined;
};

beforeEach(() => {
  m.getMarket.mockResolvedValue(market);
  m.start.mockResolvedValue({ id: 'agent-new' });
  m.createCart.mockReset();
  m.cartFor.mockReset();
});

describe('POST /api/assistant/session and the bag', () => {
  it('A shopper with a bag keeps it', async () => {
    m.getSession.mockResolvedValue({ ...guest, cartId: 'bag-1', agentSessionId: 'agent-1' });
    m.resolve.mockResolvedValue({ session: { id: 'agent-1' } });
    m.cartFor.mockResolvedValue({ id: 'bag-1' });
    const res = await post();
    expect(res.status).toBe(200);
    expect(m.createCart).not.toHaveBeenCalled();
    expect(cookieOf(res)).toBeUndefined();
  });

  it('A shopper without a bag gets one and the cookie carries it', async () => {
    m.getSession.mockResolvedValue({ ...guest });
    m.resolve.mockResolvedValue(null);
    m.cartFor.mockResolvedValue(null);
    m.createCart.mockImplementation(async (session: Session) => ({ cart: { id: 'bag-new' }, session: { ...session, cartId: 'bag-new' } }));
    const res = await post();
    expect(res.status).toBe(200);
    expect(cookieOf(res)?.cartId).toBe('bag-new');
    expect(cookieOf(res)?.agentSessionId).toBe('agent-new');
  });

  it('A cart failure still starts the session', async () => {
    m.getSession.mockResolvedValue({ ...guest });
    m.resolve.mockResolvedValue(null);
    m.cartFor.mockResolvedValue(null);
    m.createCart.mockRejectedValue(new Error('upstream down'));
    const res = await post();
    expect(res.status).toBe(200);
    expect(cookieOf(res)?.agentSessionId).toBe('agent-new');
    expect(cookieOf(res)?.cartId).toBeUndefined();
  });

  it('Sign-in keeps the bag across the session start', async () => {
    m.getSession.mockResolvedValue({ customerId: 'c-1', customerFirstName: 'Maya', cartId: 'bag-1', ...market });
    m.resolve.mockResolvedValue(null);
    m.cartFor.mockResolvedValue({ id: 'bag-1' });
    const res = await post();
    expect(m.createCart).not.toHaveBeenCalled();
    expect(cookieOf(res)?.cartId).toBe('bag-1');
  });
});
