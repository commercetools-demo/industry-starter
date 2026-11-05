import { describe, expect, it, vi } from 'vitest';
import { Unavailable } from '@/lib/agent/shopping/backend';
import type { ShoppingSessionContext } from '@/lib/agent/shopping/types';
import { LineRejected } from '@/lib/ct/cart';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import { StorefrontApiBackend, toToolError } from './assistant-backend';

// The domain error class is what the mapper tests against; the real module pulls in the commercetools client.
vi.mock('@/lib/ct/cart', () => ({
  LineRejected: class LineRejected extends Error {
    constructor(readonly code: string) {
      super(code);
      this.name = 'LineRejected';
    }
  },
}));

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const ctx = (over: Partial<ShoppingSessionContext> = {}): ShoppingSessionContext => ({
  sessionId: 's1', userId: 'user-1', page: { pageType: 'home', extra: {} }, now: new Date('2026-11-05T12:00:00Z'), timeZone: 'UTC',
  ...over,
} as ShoppingSessionContext);

const backendFor = (session: Session) => new StorefrontApiBackend({ session, market, baseHref: '/malva-coffee/en-US' });

describe('StorefrontApiBackend skeleton', () => {
  it('Unknown errors become a plain failure, never a leaked message', () => {
    const leaked = toToolError(new Error('Bearer sk-live-123 rejected by https://api.example'));
    expect(leaked).toBeInstanceOf(Error);
    expect(leaked).not.toBeInstanceOf(Unavailable);
    expect(leaked.message).toBe('The storefront is temporarily unavailable.');

    const upstream = toToolError(new AppError('upstream_unavailable', 503, 'project key abc is down'));
    expect(upstream.message).not.toContain('abc');
    expect(upstream.message).toBe('The storefront is temporarily unavailable.');
  });

  it('A rejected line is an Unavailable that names only the code', () => {
    const error = toToolError(new LineRejected('quantity_exceeds_stock', 409));
    expect(error).toBeInstanceOf(Unavailable);
    expect(error.message).toBe('The bag cannot take that line (quantity_exceeds_stock).');
  });

  it('Preferences carry no email', async () => {
    const backend = backendFor({ customerId: 'c-1', customerEmail: 'maya@example.com', customerFirstName: 'Maya' });
    const prefs = await backend.getPreferences(ctx());
    expect(prefs).toEqual({ userId: 'user-1', displayName: 'Maya', preferences: {} });
    expect(JSON.stringify(prefs)).not.toContain('@');
  });

  it('A guest has no display name', async () => {
    const prefs = await backendFor({ anonymousId: 'anon-1' }).getPreferences(ctx());
    expect('displayName' in prefs).toBe(false);
  });

  it('Methods not built yet say so as Unavailable', async () => {
    await expect(backendFor({}).getCart()).rejects.toBeInstanceOf(Unavailable);
  });

  it('Drained notes are returned once', () => {
    class Probe extends StorefrontApiBackend {
      say(text: string) {
        this.note(text);
      }
    }
    const backend = new Probe({ session: {}, market, baseHref: '/x' });
    backend.say('one');
    expect(backend.drainNotes()).toEqual(['one']);
    expect(backend.drainNotes()).toEqual([]);
  });
});
