import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReviewList from '@/components/reviews/ReviewList';
import ReviewListPanel from '@/components/reviews/ReviewListPanel';
import { expectNoAxeViolations } from '@/test/axe';
import { renderWithIntl } from '@/test/render';
import { stubFetch } from '@/test/shell';
import type { ReviewView } from '@/lib/types';

const PID = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f';
const review = (over: Partial<ReviewView> = {}): ReviewView => ({
  id: 'r1', rating: 4, title: 'Smooth', text: 'Very nice', authorName: 'Maya O.', createdAt: '2026-10-01T10:00:00.000Z',
  locale: 'en-US', verifiedPurchase: false, ...over,
});
const base = { hasMore: false, isLoading: false, isLoadingMore: false, isError: false, onLoadMore: () => {} };

afterEach(() => vi.unstubAllGlobals());

describe('ReviewList', () => {
  it('Markup in text', () => {
    const { container } = renderWithIntl(
      <ReviewList {...base} reviews={[review({ title: '<b>bold</b>', text: '<script>alert(1)</script> <b>x</b>' })]} />,
    );
    expect(screen.getByText('<script>alert(1)</script> <b>x</b>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>bold</b>')).toBeInTheDocument();
  });

  it('Verified purchase badge shows only when set', () => {
    renderWithIntl(<ReviewList {...base} reviews={[review({ id: 'a', verifiedPurchase: true }), review({ id: 'b' })]} />);
    expect(screen.getAllByText('Verified purchase')).toHaveLength(1);
  });

  it('Empty list shows Be the first to review', () => {
    renderWithIntl(<ReviewList {...base} reviews={[]} />);
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.getByText('Be the first to review')).toBeInTheDocument();
  });

  it('Show more is hidden at the end', () => {
    const { rerender } = renderWithIntl(<ReviewList {...base} reviews={[review()]} hasMore />);
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    rerender(<ReviewList {...base} reviews={[review()]} hasMore={false} />);
  });

  it('Show more is disabled with Loading while fetching', () => {
    renderWithIntl(<ReviewList {...base} reviews={[review()]} hasMore isLoadingMore />);
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('Focus moves to the first new item after Show more', async () => {
    const reviewsA = ['a', 'b', 'c', 'd', 'e'].map((id) => review({ id, text: `text ${id}` }));
    const reviewsB = [...reviewsA, ...['f', 'g'].map((id) => review({ id, text: `text ${id}` }))];
    let props = { ...base, reviews: reviewsA, hasMore: true };
    const { rerender } = renderWithIntl(<ReviewList {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    props = { ...props, reviews: reviewsB, hasMore: false };
    rerender(<ReviewList {...props} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByTestId('review-item')[5]));
    expect(screen.getByText('2 more reviews loaded')).toBeInTheDocument();
  });

  it('Dates use the session locale', () => {
    const d = review({ createdAt: '2026-10-01T10:00:00.000Z' });
    const { unmount } = renderWithIntl(<ReviewList {...base} reviews={[d]} />, { locale: 'en-CA' });
    expect(screen.getByText(new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(d.createdAt)))).toBeInTheDocument();
    unmount();
    renderWithIntl(<ReviewList {...base} reviews={[d]} />, { locale: 'en-US' });
    expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument();
  });

  it('stars always carry the text n out of 5 and the list is a ul', async () => {
    const { container } = renderWithIntl(<ReviewList {...base} reviews={[review({ rating: 1 })]} />);
    expect(screen.getByText('1 out of 5')).toBeInTheDocument();
    expect(container.querySelector('ul')).not.toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe('ReviewListPanel', () => {
  it('Sorted', async () => {
    const { calls } = stubFetch({
      '/api/reviews': () => {
        const url = calls[calls.length - 1].url;
        const rs = url.includes('sort=lowest')
          ? [review({ id: 'one', rating: 1, text: 'worst' }), review({ id: 'three', rating: 3, text: 'meh' }), review({ id: 'five', rating: 5, text: 'best' })]
          : [review({ id: 'five', rating: 5, text: 'best' }), review({ id: 'three', rating: 3, text: 'meh' }), review({ id: 'one', rating: 1, text: 'worst' })];
        return { reviews: rs, total: 3, page: 0, pageSize: 5, hasMore: false, mine: null };
      },
    });
    renderWithIntl(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ReviewListPanel productId={PID} />
      </SWRConfig>,
    );
    await waitFor(() => expect(screen.getAllByTestId('review-item')).toHaveLength(3));
    expect(screen.getAllByTestId('review-item')[0]).toHaveTextContent('best');
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'lowest' } });
    });
    await waitFor(() => expect(screen.getAllByTestId('review-item')[0]).toHaveTextContent('worst'));
    expect(calls.some((c) => c.url.includes('sort=lowest&page=0'))).toBe(true);
  });
});
