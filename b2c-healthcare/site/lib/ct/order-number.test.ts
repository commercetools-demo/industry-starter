// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { formatOrderNumber, nextOrderNumber, OrderNumberContendedError, ORDER_COUNTER_KEY } from './order-number';

beforeEach(() => {
  fake = createFakeObjects();
});

describe('checkout: order numbers from the counter', () => {
  it('formats MLV- plus a zero-padded counter', () => {
    expect(formatOrderNumber(1)).toBe('MLV-000001');
    expect(formatOrderNumber(42)).toBe('MLV-000042');
    expect(formatOrderNumber(1234567)).toBe('MLV-1234567');
  });

  it('the first number creates the counter (create-only) and later ones count up', async () => {
    expect(await nextOrderNumber()).toBe('MLV-000001');
    expect(await nextOrderNumber()).toBe('MLV-000002');
    expect(await nextOrderNumber()).toBe('MLV-000003');
    const counter = fake.objects.find((o) => o.container === CONTAINERS.counter && o.key === ORDER_COUNTER_KEY);
    expect(counter?.value).toEqual({ next: 4 });
  });

  it('continues from an existing counter (seeded or migrated)', async () => {
    fake.objects.push({ id: 'x', container: CONTAINERS.counter, key: ORDER_COUNTER_KEY, version: 7, value: { next: 100 }, createdAt: '', lastModifiedAt: '' });
    expect(await nextOrderNumber()).toBe('MLV-000100');
  });

  it('concurrent requests never get the same number (version conflicts are retried)', async () => {
    const numbers = await Promise.all(Array.from({ length: 8 }, () => nextOrderNumber()));
    expect(new Set(numbers).size).toBe(8);
    expect([...numbers].sort()).toEqual(Array.from({ length: 8 }, (_, i) => formatOrderNumber(i + 1)));
  });

  it('concurrent requests on an existing counter also stay unique and gap-free', async () => {
    await nextOrderNumber();
    const numbers = await Promise.all(Array.from({ length: 6 }, () => nextOrderNumber()));
    expect([...numbers].sort()).toEqual(Array.from({ length: 6 }, (_, i) => formatOrderNumber(i + 2)));
  });

  it('a 409 on the write is retried with a fresh read', async () => {
    await nextOrderNumber();
    let injected = 0;
    fake.failOn = (op, container) => {
      if (op === 'post' && container === CONTAINERS.counter && injected < 2) {
        injected += 1;
        return Object.assign(new Error('conflict'), { statusCode: 409 });
      }
      return undefined;
    };
    expect(await nextOrderNumber()).toBe('MLV-000002');
    expect(injected).toBe(2);
  });

  it('gives up with a named error when the counter stays contended', async () => {
    await nextOrderNumber();
    fake.failOn = () => Object.assign(new Error('conflict'), { statusCode: 409 });
    await expect(nextOrderNumber()).rejects.toBeInstanceOf(OrderNumberContendedError);
  });

  it('other errors are not swallowed', async () => {
    fake.failOn = () => Object.assign(new Error('boom'), { statusCode: 500 });
    await expect(nextOrderNumber()).rejects.toMatchObject({ statusCode: 500 });
  });

  it('a number lost to a failed order is not handed out again', async () => {
    const lost = await nextOrderNumber();
    const next = await nextOrderNumber();
    expect(next).not.toBe(lost);
  });
});
