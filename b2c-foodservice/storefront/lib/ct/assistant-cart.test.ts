import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';

const m = vi.hoisted(() => ({ cartFor: vi.fn(), createCart: vi.fn() }));

vi.mock('@/lib/ct/cart', () => ({ getCartForSession: m.cartFor, createCart: m.createCart }));

import { ensureAssistantBag } from './assistant-cart';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const guest: Session = { anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US' };

describe('ensureAssistantBag', () => {
  it('A shopper with a bag keeps it', async () => {
    m.cartFor.mockResolvedValue({ id: 'bag-1' });
    const held: Session = { ...guest, cartId: 'bag-1' };
    expect(await ensureAssistantBag(held, market)).toBe(held);
    expect(m.createCart).not.toHaveBeenCalled();
  });

  it('A shopper without a bag gets one and the session carries it', async () => {
    m.cartFor.mockResolvedValue(null);
    m.createCart.mockResolvedValue({ cart: { id: 'bag-new' }, session: { ...guest, cartId: 'bag-new' } });
    const next = await ensureAssistantBag(guest, market);
    expect(next.cartId).toBe('bag-new');
    expect(m.createCart).toHaveBeenCalledWith(guest, market);
  });

  it('A bag that is no longer active is replaced', async () => {
    m.cartFor.mockResolvedValue(null);
    m.createCart.mockResolvedValue({ cart: { id: 'bag-2' }, session: { ...guest, cartId: 'bag-2' } });
    expect((await ensureAssistantBag({ ...guest, cartId: 'gone' }, market)).cartId).toBe('bag-2');
  });

  it('A cart failure still starts the session, with no bag', async () => {
    m.cartFor.mockResolvedValue(null);
    m.createCart.mockRejectedValue(new Error('upstream 503 with project detail'));
    const next = await ensureAssistantBag(guest, market);
    expect(next).toBe(guest);
    expect(next.cartId).toBeUndefined();
  });

  it('A signed-in shopper keeps the bag across sign-in', async () => {
    m.cartFor.mockResolvedValue({ id: 'bag-1' });
    const signedIn: Session = { customerId: 'c-1', cartId: 'bag-1', country: 'US', currency: 'USD', locale: 'en-US' };
    expect((await ensureAssistantBag(signedIn, market)).cartId).toBe('bag-1');
    expect(m.createCart).not.toHaveBeenCalled();
  });
});
