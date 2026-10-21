import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewActions } from '@/hooks/useReviewActions';
import { useReviews } from '@/hooks/useReviews';
import { stubFetch } from '@/test/shell';

const PID = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f';
const rev = (id: string, rating = 5) => ({ id, rating, title: null, text: id, authorName: 'A B.', createdAt: '2026-10-01T00:00:00Z', locale: 'en-US', verifiedPurchase: false });
const page = (ids: string[], p: number, total: number, mine: { id: string } | null = null) => ({
  reviews: ids.map((i) => rev(i)), total, page: p, pageSize: 5, hasMore: (p + 1) * 5 < total, mine,
});

const wrapperFor = () => {
  const cache = new Map();
  function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>;
  }
  return Wrapper;
};

afterEach(() => vi.unstubAllGlobals());

describe('useReviews', () => {
  it('Show more appends the next page', async () => {
    const { calls } = stubFetch({
      '/api/reviews': () => {
        const last = calls[calls.length - 1].url;
        return last.includes('page=1') ? page(['f', 'g'], 1, 7) : page(['a', 'b', 'c', 'd', 'e'], 0, 7);
      },
    });
    const { result } = renderHook(() => useReviews(PID, 'newest'), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.reviews).toHaveLength(5));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.total).toBe(7);
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.reviews.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
    expect(result.current.hasMore).toBe(false);
  });

  it('Changing the sort resets to the first page', async () => {
    const { calls } = stubFetch({
      '/api/reviews': () => {
        const last = calls[calls.length - 1].url;
        if (last.includes('sort=lowest')) return page(['low1'], 0, 1);
        return last.includes('page=1') ? page(['f'], 1, 6) : page(['a', 'b', 'c', 'd', 'e'], 0, 6);
      },
    });
    const { result, rerender } = renderHook(({ sort }: { sort: 'newest' | 'lowest' }) => useReviews(PID, sort), {
      wrapper: wrapperFor(), initialProps: { sort: 'newest' },
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(5));
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(6));
    rerender({ sort: 'lowest' });
    await waitFor(() => expect(result.current.reviews.map((r) => r.id)).toEqual(['low1']));
    expect(calls.some((c) => c.url.includes('sort=lowest&page=0'))).toBe(true);
  });

  it('Hooks return safe defaults on error', async () => {
    stubFetch({});
    const { result } = renderHook(() => useReviews(PID, 'newest'), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.mine).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useReviewActions', () => {
  it('A created review revalidates the list and my reviews', async () => {
    let version = 0;
    const { calls } = stubFetch({
      '/api/reviews?productId': () => page(version ? ['new', 'a'] : ['a'], 0, version ? 2 : 1, version ? { id: 'new' } : null),
      '/api/reviews?mine=1': () => ({ reviews: [] }),
      '/api/reviews': (init) => {
        if (init?.method === 'POST') {
          version = 1;
          return { review: { ...rev('new'), version: 1, product: null } };
        }
        return {};
      },
    });
    const wrapper = wrapperFor();
    const { result } = renderHook(() => ({ list: useReviews(PID, 'newest'), actions: useReviewActions('c1') }), { wrapper });
    await waitFor(() => expect(result.current.list.reviews).toHaveLength(1));
    await act(async () => {
      await result.current.actions.create(PID, { rating: 5 });
    });
    await waitFor(() => expect(result.current.list.reviews.map((r) => r.id)).toEqual(['new', 'a']));
    expect(result.current.list.mine).toEqual({ id: 'new' });
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ productId: PID, rating: 5 });
  });

  it('a failed create throws the server code and the existing review id', async () => {
    stubFetch({
      '/api/reviews': () => Response.json({ error: { code: 'already_reviewed', message: 'x', reviewId: 'r-old' } }, { status: 409 }),
    });
    const { result } = renderHook(() => useReviewActions('c1'), { wrapper: wrapperFor() });
    await expect(result.current.create(PID, { rating: 4 })).rejects.toMatchObject({ code: 'already_reviewed', status: 409, extra: { reviewId: 'r-old' } });
  });
});
