import { describe, expect, it, vi } from 'vitest';
import type { ListingResult } from './load';

// Outside a React server render `cache` does not memoise; emulate one render with a single shared holder.
vi.mock('react', async (orig) => {
  const actual = await orig<typeof import('react')>();
  return { ...actual, cache: <T extends () => unknown>(fn: T) => { let v: unknown; return (() => (v ??= fn())) as T; } };
});
vi.mock('server-only', () => ({}));

import { provideListing, requestListing } from './request-listing';

const ok = { kind: 'ok', scope: 'category' } as unknown as ListingResult;

describe('requestListing', () => {
  it('is null before a route provides a listing', async () => {
    vi.resetModules();
    const fresh = await import('./request-listing');
    expect(await fresh.requestListing()).toBeNull();
  });

  it('hands every component the same listing', async () => {
    provideListing(Promise.resolve(ok));
    expect(await requestListing()).toBe(ok);
    expect(await requestListing()).toBe(ok);
  });

  it('is null for a redirect, a prompt or an unsupported language', async () => {
    for (const r of [{ kind: 'redirect', href: '/x' }, { kind: 'prompt' }, { kind: 'unsupported_language' }]) {
      provideListing(Promise.resolve(r as unknown as ListingResult));
      expect(await requestListing()).toBeNull();
    }
  });
});
