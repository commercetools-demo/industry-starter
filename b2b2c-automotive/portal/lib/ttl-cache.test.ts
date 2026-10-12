// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { createTtlCache } from './ttl-cache';

function make() {
  let t = 1_000;
  const cache = createTtlCache<string>({ ttlMs: 60_000, negativeTtlMs: 10_000, now: () => t });
  return { cache, advance: (ms: number) => (t += ms) };
}

describe('Store cache', () => {
  it('Cache hit within the TTL', () => {
    const { cache, advance } = make();
    cache.set('a', 'A');
    advance(59_999);
    expect(cache.get('a')).toBe('A');
  });
  it('Cache expiry', () => {
    const { cache, advance } = make();
    cache.set('a', 'A');
    advance(60_000);
    expect(cache.get('a')).toBeUndefined();
  });
  it('Negative entries expire sooner', () => {
    const { cache, advance } = make();
    cache.set('missing', null);
    advance(9_999);
    expect(cache.get('missing')).toBeNull();
    advance(1);
    expect(cache.get('missing')).toBeUndefined();
  });
  it('Stale value is available after expiry, a negative entry is not', () => {
    const { cache, advance } = make();
    cache.set('a', 'A');
    cache.set('missing', null);
    advance(120_000);
    expect(cache.getStale('a')).toBe('A');
    expect(cache.getStale('missing')).toBeUndefined();
    expect(cache.getStale('never')).toBeUndefined();
  });
  it('clear empties the cache', () => {
    const { cache } = make();
    cache.set('a', 'A');
    cache.clear();
    expect(cache.getStale('a')).toBeUndefined();
  });
});
