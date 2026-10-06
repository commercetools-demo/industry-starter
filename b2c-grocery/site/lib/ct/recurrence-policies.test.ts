import { describe, it, expect, vi, beforeEach } from 'vitest';

const unstableCache = vi.fn((...args: [() => unknown, string[], { revalidate: number }]) => args[0]);
vi.mock('next/cache', () => ({ unstable_cache: (...args: [() => unknown, string[], { revalidate: number }]) => unstableCache(...args) }));

const execute = vi.fn();
const get = vi.fn();
vi.mock('./client', () => ({ getApiRoot: () => ({ recurrencePolicies: () => ({ get: (arg: unknown) => (get(arg), { execute }) }) }) }));

import { getRecurrencePolicies } from './recurrence-policies';

const policy = (key: string, id: string, en: string, de: string, value: number, intervalUnit: string) => ({
  key,
  id,
  name: { 'en-US': en, 'de-DE': de },
  schedule: { type: 'standard', value, intervalUnit },
});

beforeEach(() => {
  vi.clearAllMocks();
  // the API may return them in any order: the function orders them
  execute.mockResolvedValue({
    body: {
      results: [
        policy('monthly', 'p3', 'Every month', 'Jeden Monat', 1, 'Months'),
        policy('weekly', 'p1', 'Every week', 'Jede Woche', 1, 'Weeks'),
        policy('every-2-weeks', 'p2', 'Every 2 weeks', 'Alle 2 Wochen', 2, 'Weeks'),
      ],
    },
  });
});

describe('getRecurrencePolicies', () => {
  it('Policies localized: names follow the locale and the order is weekly, every 2 weeks, monthly', async () => {
    expect((await getRecurrencePolicies('de-DE')).map((p) => [p.key, p.id, p.name])).toEqual([
      ['weekly', 'p1', 'Jede Woche'],
      ['every-2-weeks', 'p2', 'Alle 2 Wochen'],
      ['monthly', 'p3', 'Jeden Monat'],
    ]);
    expect((await getRecurrencePolicies('en-US'))[1].name).toBe('Every 2 weeks');
  });

  it('only the three offered keys are requested', async () => {
    await getRecurrencePolicies('en-US');
    expect(get.mock.calls[0][0].queryArgs.where).toBe('key in ("weekly", "every-2-weeks", "monthly")');
  });

  it('exposes the standard schedule for matching a recurring order to a policy', async () => {
    expect((await getRecurrencePolicies('en-US'))[1].schedule).toEqual({ value: 2, intervalUnit: 'Weeks' });
  });

  it('cache wrapper: revalidate 300 and the key includes the locale', async () => {
    await getRecurrencePolicies('de-DE');
    await getRecurrencePolicies('en-US');
    expect(unstableCache.mock.calls[0][1]).toEqual(['recurrence-policies', 'de-DE']);
    expect(unstableCache.mock.calls[0][2]).toEqual({ revalidate: 300 });
    expect(unstableCache.mock.calls[1][1]).toEqual(['recurrence-policies', 'en-US']);
  });
});
