// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), updateSession: vi.fn() }));

import { getSession, updateSession } from '@/lib/session';
import { GET } from './me/route';
import { POST } from './logout/route';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/auth/logout', () => {
  it('Logout: clears the identity fields and the cart id and answers { ok: true }', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateSession).toHaveBeenCalledWith(
      { customerId: undefined, customerEmail: undefined, customerFirstName: undefined, customerLastName: undefined, cartId: undefined },
      expect.anything(),
    );
  });
});

describe('GET /api/auth/me', () => {
  it('anonymous: { user: null } and no cache', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'c' });
    const res = await GET();
    expect(await res.json()).toEqual({ user: null });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('signed in: the user comes from the session only', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'c-1', customerEmail: 'a@b.co', customerFirstName: 'Ada', customerLastName: 'L' });
    expect(await (await GET()).json()).toEqual({ user: { id: 'c-1', email: 'a@b.co', firstName: 'Ada', lastName: 'L' } });
  });
});
