import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import { renderShell, stubFetch } from '@/test/shell';
import type { MyReviewView } from '@/lib/types';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const PID = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f';
const customer = { id: 'c1', email: 'qa@example.com', firstName: 'Maya', lastName: 'Okonkwo', defaultShippingAddressId: null, addresses: [] };
const mine = (over: Partial<MyReviewView> = {}): MyReviewView => ({
  id: 'r-mine', rating: 3, title: 'So so', text: 'It was fine', authorName: 'Maya O.', createdAt: '2026-09-01T10:00:00.000Z', locale: 'en-US',
  verifiedPurchase: false, version: 1, product: null, ...over,
});

interface Backend {
  customer: typeof customer | null;
  reviews: MyReviewView[];
  postStatus?: number;
  patchStatus?: number;
}

function install(b: Backend) {
  const own = () => b.reviews.find((r) => r.authorName === 'Maya O.');
  return stubFetch({
    '/api/auth/me': () => ({ customer: b.customer }),
    '/api/reviews?productId': () => ({
      reviews: b.reviews, total: b.reviews.length, page: 0, pageSize: 5, hasMore: false, mine: b.customer && own() ? { id: own()?.id } : null,
    }),
    '/api/reviews?mine=1': () => ({ reviews: b.reviews.filter((r) => r.authorName === 'Maya O.') }),
    '/api/reviews/': (init) => {
      if (b.patchStatus) return Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: b.patchStatus });
      const body = JSON.parse(String(init?.body));
      const r = own();
      if (!r) return Response.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 });
      Object.assign(r, body);
      return { review: r };
    },
    '/api/reviews': (init) => {
      if (b.postStatus === 409) {
        b.reviews.unshift(mine());
        return Response.json({ error: { code: 'already_reviewed', message: 'x', reviewId: 'r-mine' } }, { status: 409 });
      }
      if (b.postStatus === 429) return Response.json({ error: { code: 'rate_limited', message: 'x' } }, { status: 429 });
      if (b.postStatus) return Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: b.postStatus });
      const body = JSON.parse(String(init?.body));
      const created = mine({ id: 'r-new', rating: body.rating, title: body.title ?? null, text: body.text ?? null, createdAt: '2026-10-21T10:00:00.000Z' });
      b.reviews.unshift(created);
      return Response.json({ review: created }, { status: 201 });
    },
  });
}

const mount = () => renderShell(<ReviewsSection productId={PID} productSlug="ember" sku="MCF-POD-EMBER-10" productName="Ember" stats={null} />);
const posts = (calls: { url: string; init?: RequestInit }[]) => calls.filter((c) => c.init?.method === 'POST');

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => vi.unstubAllGlobals());

describe('ReviewsSection', () => {
  it('Guests are asked to sign in and return', async () => {
    install({ customer: null, reviews: [] });
    mount();
    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/account/sign-in?redirect=%2Fp%2Fember%2FMCF-POD-EMBER-10%23write-review');
    expect(screen.getByText('Sign in to write a review.')).toBeInTheDocument();
  });

  it('Valid review', async () => {
    const { calls } = install({ customer, reviews: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    expect(screen.getByText('Posted as Maya O.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.type(screen.getByLabelText('Your review (optional)'), 'Lovely crema');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText('Thanks, your review is live. The average updates shortly.')).toBeInTheDocument();
    expect(JSON.parse(String(posts(calls)[0].init?.body))).toEqual({ productId: PID, rating: 4, text: 'Lovely crema' });
  });

  it('New review is published at once', async () => {
    install({ customer, reviews: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.type(screen.getByLabelText('Your review (optional)'), 'Instant');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    // the list refreshed: the new review is in it with no pending tag, and the CTA turns into the reviewed state
    expect(await screen.findByText('Instant')).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).toBeNull();
    expect(await screen.findByText(/You reviewed this product on/)).toBeInTheDocument();
  });

  it('Missing rating', async () => {
    const { calls } = install({ customer, reviews: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByText('Choose a rating')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
  });

  it('Duplicate', async () => {
    install({ customer, reviews: [], postStatus: 409 });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('radio', { name: '2 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText(/You have already reviewed this product/)).toBeInTheDocument();
    // the form is replaced by the edit state, prefilled with the existing review
    expect(await screen.findByRole('heading', { name: 'Edit your review' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your review (optional)')).toHaveValue('It was fine');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('Edit prefills and shows the changes-live message', async () => {
    const { calls } = install({ customer, reviews: [mine()] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit your review' }));
    const text = screen.getByLabelText('Your review (optional)');
    expect(text).toHaveValue('It was fine');
    expect(screen.getByLabelText('Title (optional)')).toHaveValue('So so');
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.clear(text);
    await userEvent.type(text, 'Much better now');
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Your changes are live.')).toBeInTheDocument();
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(patch?.url).toBe('/api/reviews/r-mine');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ rating: 5, title: 'So so', text: 'Much better now' });
    expect(await screen.findByText('Much better now')).toBeInTheDocument();
  });

  it('Form keeps entries on error', async () => {
    install({ customer, reviews: [], postStatus: 500 });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.type(screen.getByLabelText('Title (optional)'), 'Keep me');
    await userEvent.type(screen.getByLabelText('Your review (optional)'), 'Still here');
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save your review. Please try again.');
    expect(screen.getByLabelText('Title (optional)')).toHaveValue('Keep me');
    expect(screen.getByLabelText('Your review (optional)')).toHaveValue('Still here');
    expect(screen.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a rate limit shows its own message and keeps the form', async () => {
    install({ customer, reviews: [], postStatus: 429 });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You have posted a lot of reviews. Please try again later.');
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
  });

  it('Star input is keyboard operable', async () => {
    install({ customer, reviews: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    radios[0].focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '3 stars' }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '2 stars' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Counters stop at the limits', async () => {
    install({ customer, reviews: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
    const title = screen.getByLabelText('Title (optional)');
    await userEvent.click(title);
    await userEvent.paste('x'.repeat(100));
    expect((title as HTMLInputElement).value).toHaveLength(80);
    expect(screen.getByText('80/80')).toBeInTheDocument();
    const text = screen.getByLabelText('Your review (optional)');
    await userEvent.click(text);
    await userEvent.paste('y'.repeat(2100));
    expect((text as HTMLTextAreaElement).value).toHaveLength(2000);
    expect(screen.getByText('2000/2000')).toBeInTheDocument();
  });

  it('the sign-in return trip opens the form at #write-review', async () => {
    window.location.hash = '#write-review';
    install({ customer, reviews: [] });
    mount();
    expect(await screen.findByRole('heading', { name: 'Write a review' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Write a review' })).toHaveAttribute('aria-expanded', 'true'));
  });

  it('the form stays closed at #write-review when the customer already reviewed', async () => {
    window.location.hash = '#write-review';
    install({ customer, reviews: [mine()] });
    mount();
    await screen.findByRole('button', { name: 'Edit your review' });
    expect(screen.queryByRole('heading', { name: 'Write a review' })).toBeNull();
  });
});
