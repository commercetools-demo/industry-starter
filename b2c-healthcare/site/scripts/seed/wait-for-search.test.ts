import { describe, expect, it } from 'vitest';
import { createFakeRoot } from './fake-root';
import { parseWaitArgs, waitForSearch } from './wait-for-search';

describe('wait-for-search', () => {
  it('returns as soon as the index holds the expected count', async () => {
    const fake = createFakeRoot({ products: [{ key: 'mlv-a', masterData: { published: true, staged: {} } }] });
    expect(await waitForSearch(fake.root, { expected: 1, log: () => {}, sleep: async () => {} })).toBe(1);
    expect(fake.searchCalls).toBe(1);
  });

  it('polls until the index catches up', async () => {
    const fake = createFakeRoot();
    fake.searchTotal = 0;
    let slept = 0;
    const total = await waitForSearch(fake.root, {
      expected: 3,
      log: () => {},
      sleep: async () => { slept += 1; fake.searchTotal = slept; },
    });
    expect(total).toBe(3);
    expect(fake.searchCalls).toBe(4);
  });

  it('times out with the counts in the message', async () => {
    const fake = createFakeRoot();
    fake.searchTotal = 2;
    let t = 0;
    await expect(
      waitForSearch(fake.root, { expected: 5, timeoutMs: 30_000, intervalMs: 10_000, log: () => {}, sleep: async () => { t += 10_000; }, now: () => t }),
    ).rejects.toThrow(/Timed out.*2 of 5/);
  });

  it('refuses when indexing is not Activated', async () => {
    const fake = createFakeRoot();
    (fake.root as unknown as { get: () => unknown }).get = () => ({ execute: async () => ({ body: { searchIndexing: { productsSearch: { status: 'Deactivated' } } } }) });
    await expect(waitForSearch(fake.root, { expected: 1, log: () => {} })).rejects.toThrow(/Activated/);
  });

  it('parseWaitArgs bounds', () => {
    expect(parseWaitArgs([], 28)).toEqual({ expected: 28, timeoutMs: 300_000 });
    expect(parseWaitArgs(['--expected', '3', '--timeout-min', '1'], 28)).toEqual({ expected: 3, timeoutMs: 60_000 });
    expect(() => parseWaitArgs(['--timeout-min', '99'], 1)).toThrow();
    expect(() => parseWaitArgs(['--expected', 'x'], 1)).toThrow();
  });
});
