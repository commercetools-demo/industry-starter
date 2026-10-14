// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('Token bucket', () => {
  it('allows the limit, then refuses, then refills over time', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 10; i += 1) expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
    now += 6_000;
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
  });

  it('forgets the oldest key beyond maxKeys', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0, maxKeys: 2 });
    limiter.take('a');
    limiter.take('b');
    limiter.take('c');
    expect(limiter.take('a')).toBe(true);
  });
});
