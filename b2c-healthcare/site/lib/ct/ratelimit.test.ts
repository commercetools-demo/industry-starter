import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { getRateLimitStatus, RATE_LIMIT, recordFailedLookup } from '@/lib/ct/ratelimit';

const T0 = new Date('2026-10-08T12:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;

describe('rate limit of failed lookups', () => {
  beforeEach(() => {
    fake = createFakeObjects();
  });

  it('a customer with no failures is not limited', async () => {
    expect(await getRateLimitStatus('c1', T0)).toEqual({ limited: false, remaining: 5, retryAfterSeconds: 0 });
  });

  it('the 5th failed lookup in 10 minutes limits the customer', async () => {
    for (let i = 0; i < 4; i += 1) expect((await recordFailedLookup('c1', at(i * MIN))).limited).toBe(false);
    const fifth = await recordFailedLookup('c1', at(4 * MIN));
    expect(fifth).toMatchObject({ limited: true, remaining: 0, retryAfterSeconds: 6 * 60 });
    expect((await getRateLimitStatus('c1', at(5 * MIN))).limited).toBe(true);
  });

  it('window rollover: once the oldest failures are 10 minutes old the customer may try again', async () => {
    for (let i = 0; i < 5; i += 1) await recordFailedLookup('c1', at(i * 1000));
    expect((await getRateLimitStatus('c1', at(RATE_LIMIT.windowMs - 1))).limited).toBe(true);
    // the first failure (t=0) leaves the window at exactly 10 minutes
    const after = await getRateLimitStatus('c1', at(RATE_LIMIT.windowMs));
    expect(after).toMatchObject({ limited: false, remaining: 1 });
    expect((await getRateLimitStatus('c1', at(RATE_LIMIT.windowMs + 5000))).remaining).toBe(5);
  });

  it('failures older than the window are dropped when recording', async () => {
    await recordFailedLookup('c1', T0);
    const s = await recordFailedLookup('c1', at(11 * MIN));
    expect(s.remaining).toBe(4);
    expect((fake.objects[0].value as { failures: number[] }).failures).toEqual([at(11 * MIN).getTime()]);
  });

  it('counts are per customer', async () => {
    for (let i = 0; i < 5; i += 1) await recordFailedLookup('c1', at(i));
    expect((await getRateLimitStatus('c2', at(10))).limited).toBe(false);
  });

  it('concurrent failures never lose a count (optimistic concurrency retries on 409)', async () => {
    await Promise.all(Array.from({ length: 4 }, (_, i) => recordFailedLookup('c1', at(i))));
    expect((await getRateLimitStatus('c1', at(10))).remaining).toBe(1);
    expect(fake.objects.filter((o) => o.container === CONTAINERS.ratelimit)).toHaveLength(1);
  });

  it('gives up with a clear error when a write keeps conflicting', async () => {
    fake.failOn = () => Object.assign(new Error('conflict'), { statusCode: 409 });
    await expect(recordFailedLookup('c1', T0)).rejects.toThrow('contended');
  });

  it('other errors are not swallowed', async () => {
    fake.failOn = () => Object.assign(new Error('boom'), { statusCode: 500 });
    await expect(recordFailedLookup('c1', T0)).rejects.toThrow('boom');
  });

  it('the customer id is made safe for a Custom Object key', async () => {
    await recordFailedLookup('a/b c', T0);
    expect(fake.objects[0].key).toMatch(/^[-_~.a-zA-Z0-9]+$/);
  });
});
