// @vitest-environment node
import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPayParts, clearPayParts } from '@/lib/checkout/pay-cookie';
import { applyPlacement, type Placement } from '@/lib/checkout/placed';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ct/checkout', () => ({ removePaidLines: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

afterEach(() => vi.unstubAllEnvs());

const placement = (over: Partial<Placement> = {}): Placement =>
  ({ matched: true, next: null, clearParts: true, guestEmail: 'tst-1@example.com', session: {}, ...over }) as Placement;

describe('Checkout cookies are Secure in production', () => {
  it('the pay cookie (cart ids of the payments) and its removal carry Secure and HttpOnly in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const set = setPayParts(NextResponse.json({}), [{ id: 'c1', part: 0, clusterKey: 'delivery', label: null, totalCents: 100 }]);
    expect(set.headers.get('set-cookie')).toMatch(/Secure/i);
    expect(set.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(clearPayParts(NextResponse.json({})).headers.get('set-cookie')).toMatch(/Secure/i);
  });

  it('the guest email cookie (an email address, one hour) carries Secure and HttpOnly in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await applyPlacement(NextResponse.json({}), placement());
    const cookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('mcf_guest_email=')) ?? '';
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('in development the cookies are not Secure (plain http on localhost)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const set = setPayParts(NextResponse.json({}), [{ id: 'c1', part: 0, clusterKey: 'delivery', label: null, totalCents: 100 }]);
    expect(set.headers.get('set-cookie')).not.toMatch(/Secure/i);
  });
});
