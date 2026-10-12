// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { createTtlCache } from './ttl-cache';

function make() {
  let t = 1000;
  const cache = createTtlCache<string>({ ttlMs: 60_000, negativeTtlMs: 10_000, now: () => t });
  return { cache, advance: (ms: number) => (t += ms) };
}

describe('Store resolved from the path: TTL cache', () => {
  it('Cache hit within the TTL', () => {
    const { cache, advance } = make();
    cache.set('a', 'A');
    advance(59_000);
    expect(cache.get('a')).toEqual({ value: 'A' });
  });
  it('Cache expiry', () => {
    const { cache, advance } = make();
    cache.set('a', 'A');
    advance(60_000);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.getStale('a')).toEqual({ value: 'A' });
  });
  it('Negative entries expire sooner', () => {
    const { cache, advance } = make();
    cache.set('gone', null);
    cache.set('there', 'T');
    advance(10_000);
    expect(cache.get('gone')).toBeUndefined();
    expect(cache.get('there')).toEqual({ value: 'T' });
  });
  it('A negative entry is distinguishable from a miss', () => {
    const { cache } = make();
    expect(cache.get('x')).toBeUndefined();
    cache.set('x', null);
    expect(cache.get('x')).toEqual({ value: null });
  });
});
