import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { countUnansweredReviews } from './reviews';

beforeEach(() => adminMock.reset());

describe('dashboard reviews', () => {
  it('unanswered excludes replied and other stores; absent type gives 0', async () => {
    adminMock.respond('reviews', { total: 4, results: [] });
    expect(await countUnansweredReviews('store-a')).toBe(4);
    const where = String(adminMock.callsTo('reviews')[0].queryArgs.where);
    expect(where).toContain('storeKey="store-a"');
    expect(where).toContain('replyText is not defined');

    adminMock.respond('reviews', Object.assign(new Error('type not found'), { statusCode: 400 }));
    expect(await countUnansweredReviews('store-a')).toBe(0);
  });

  it('other failures reject', async () => {
    adminMock.respond('reviews', Object.assign(new Error('down'), { statusCode: 503 }));
    await expect(countUnansweredReviews('store-a')).rejects.toThrow('down');
  });

  it('a quote in the store key cannot break out of the predicate', async () => {
    adminMock.respond('reviews', { total: 0 });
    await countUnansweredReviews('a") or custom(fields(x="');
    expect(String(adminMock.callsTo('reviews')[0].queryArgs.where)).not.toContain('a")');
  });
});
