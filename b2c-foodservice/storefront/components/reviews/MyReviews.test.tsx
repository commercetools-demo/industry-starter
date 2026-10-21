import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MyReviews from '@/components/reviews/MyReviews';
import { renderShell, stubFetch } from '@/test/shell';
import type { MyReviewView } from '@/lib/types';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const customer = { id: 'c1', email: 'qa@example.com', firstName: 'Maya', lastName: 'Okonkwo', defaultShippingAddressId: null, addresses: [] };
const review = (over: Partial<MyReviewView> = {}): MyReviewView => ({
  id: 'r1', rating: 4, title: 'Great', text: 'Rich and sweet', authorName: 'Maya O.', createdAt: '2026-09-01T10:00:00.000Z', locale: 'en-US',
  verifiedPurchase: false, version: 1,
  product: { id: 'p1', name: 'Ember Pods', slug: 'ember', sku: 'MCF-POD-EMBER-10', imageUrl: 'https://img.example.com/e.jpg?w=160&h=192' },
  ...over,
});

function install(state: { reviews: MyReviewView[]; listStatus?: number }) {
  return stubFetch({
    '/api/auth/me': () => ({ customer }),
    '/api/reviews?mine=1': () =>
      state.listStatus ? Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: state.listStatus }) : { reviews: state.reviews },
    '/api/reviews/': (init) => {
      if (init?.method === 'DELETE') {
        state.reviews = state.reviews.filter((r) => r.id !== 'r1');
        return { ok: true };
      }
      const body = JSON.parse(String(init?.body));
      state.reviews = state.reviews.map((r) => (r.id === 'r1' ? { ...r, ...body } : r));
      return { review: state.reviews[0] };
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('MyReviews (account Reviews tab)', () => {
  it('Own reviews have no pending tag', async () => {
    install({ reviews: [review(), review({ id: 'r2', title: 'Fine', product: null })] });
    renderShell(<MyReviews />);
    expect(await screen.findAllByTestId('my-review')).toHaveLength(2);
    expect(screen.queryByText(/pending|approved|moderat/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Ember Pods' })).toHaveAttribute('href', '/p/ember/MCF-POD-EMBER-10');
    expect(screen.getByText('This product is no longer available.')).toBeInTheDocument();
  });

  it('Empty state', async () => {
    install({ reviews: [] });
    renderShell(<MyReviews />);
    expect(await screen.findByText('You have not written any reviews yet.')).toBeInTheDocument();
  });

  it('Edit: an edited review stays published', async () => {
    const state = { reviews: [review()] };
    const { calls } = install(state);
    renderShell(<MyReviews />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit your review' });
    const text = within(dialog).getByLabelText('Your review (optional)');
    expect(text).toHaveValue('Rich and sweet');
    await userEvent.clear(text);
    await userEvent.type(text, 'Even better');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('Even better')).toBeInTheDocument());
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(patch?.url).toBe('/api/reviews/r1');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ rating: 4, title: 'Great', text: 'Even better' });
    expect(screen.queryByText(/pending/i)).toBeNull();
    expect(await screen.findByText('Your changes are live.')).toBeInTheDocument();
  });

  it('Delete asks for confirmation and removes the card', async () => {
    const state = { reviews: [review(), review({ id: 'r2', title: 'Other' })] };
    const { calls } = install(state);
    renderShell(<MyReviews />);
    const cards = await screen.findAllByTestId('my-review');
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this review?' });
    expect(within(dialog).getByText('This cannot be undone.')).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false); // nothing is deleted before the confirmation
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete review' }));
    await waitFor(() => expect(screen.getAllByTestId('my-review')).toHaveLength(1));
    expect(calls.find((c) => c.init?.method === 'DELETE')?.url).toBe('/api/reviews/r1');
    expect(await screen.findByText('Review deleted.')).toBeInTheDocument();
  });

  it('Cancel in the confirmation keeps the review', async () => {
    const { calls } = install({ reviews: [review()] });
    renderShell(<MyReviews />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this review?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByTestId('my-review')).toHaveLength(1);
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false);
  });

  it('Reviews panel failure does not hide the other account panels', async () => {
    install({ reviews: [], listStatus: 500 });
    renderShell(
      <div>
        <section aria-label="Orders panel">Orders</section>
        <MyReviews />
      </div>,
    );
    expect(await screen.findByTestId('my-reviews-error')).toHaveTextContent('We could not load your reviews. Please try again.');
    expect(screen.getByLabelText('Orders panel')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('long text is clamped with Show more', async () => {
    install({ reviews: [review({ text: 'word '.repeat(80) })] });
    renderShell(<MyReviews />);
    const more = await screen.findByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });
});
