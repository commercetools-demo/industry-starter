// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewItem } from '@/lib/types';
import { renderVehicle } from '@/test/vehicle';
import { ProductReviews, type ProductReviewsProps } from './ProductReviews';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/s/p/x',
}));

const reviews: ReviewItem[] = [
  { id: 'r1', author: 'Lena K.', rating: 5, title: 'Quiet', text: 'Fits well.', createdAt: '2026-09-30T10:00:00.000Z' },
  { id: 'r2', author: 'Marc T.', rating: 4, title: 'Good', text: '<b>Solid</b>', createdAt: '2026-09-01T10:00:00.000Z', reply: { text: 'Thank you!', by: 'Küstenwerk' } },
];
const props = (over: Partial<ProductReviewsProps> = {}): ProductReviewsProps => ({ productId: 'p1', store: 's', storeName: 'Küstenwerk', rating: { average: 4.5, count: 2 }, reviews, form: 'signed-out', ...over });
const render = (p = props()) => renderVehicle(<ProductReviews {...p} />, { locale: 'en-US' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => router.refresh.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('Reviews list', () => {
  it('shows the summary from the statistics and the reviews with stars as text', () => {
    render();
    expect(screen.getByRole('heading', { name: 'Customer reviews' })).toBeInTheDocument();
    expect(screen.getByText('2 reviews', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('5 of 5')).toBeInTheDocument();
    expect(screen.getByText('4 of 5')).toBeInTheDocument();
    expect(screen.getByText('Quiet')).toBeInTheDocument();
  });
  it('review text renders as text, never as html', () => {
    const { container } = render();
    expect(screen.getByText('<b>Solid</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });
  it('the reply shows under the review with its author', () => {
    render();
    expect(screen.getByText('Reply from Küstenwerk')).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
  });
  it('says there are no reviews yet', () => {
    render(props({ rating: null, reviews: [] }));
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
  });
  it('is hidden without reviews when review writing is off', () => {
    const { container } = render(props({ rating: null, reviews: [], form: null }));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Review form', () => {
  it('a signed-out visitor is asked to sign in', () => {
    render();
    expect(screen.getByRole('link', { name: 'Sign in to review parts you bought.' })).toHaveAttribute('href', '/en-US/s/account');
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument();
  });
  it('explains why a non-buyer or a second review has no form', () => {
    render(props({ form: 'not-purchased' }));
    expect(screen.getByText('Only customers who bought this part can review it.')).toBeInTheDocument();
  });
  it('already reviewed has no form', () => {
    render(props({ form: 'already-reviewed' }));
    expect(screen.getByText('You have already reviewed this part.')).toBeInTheDocument();
  });

  it('an eligible customer submits a review and the page re-reads the list', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/reviews') {
          bodies.push(JSON.parse(String(init?.body)));
          return json({ id: 'new' }, 201);
        }
        return json({}, 404);
      }),
    );
    const user = userEvent.setup();
    render(props({ form: 'eligible' }));
    await user.click(screen.getByText('4', { selector: 'label span:last-child' }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' Great pads ');
    await user.type(screen.getByRole('textbox', { name: 'Your review' }), 'Fit perfectly.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    await waitFor(() => expect(bodies).toEqual([{ productId: 'p1', rating: 4, title: 'Great pads', text: 'Fit perfectly.' }]));
    expect(await screen.findByText('Thank you. Your review is published.')).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('asks for a rating, title and text before posting', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(props({ form: 'eligible' }));
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a rating');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a refused review shows the reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'not-purchased' }, 403)));
    const user = userEvent.setup();
    render(props({ form: 'eligible' }));
    await user.click(screen.getByText('5', { selector: 'label span:last-child' }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'T');
    await user.type(screen.getByRole('textbox', { name: 'Your review' }), 'X');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only customers who bought this part can review it.');
  });

  it('no axe violations with the form', async () => {
    const { container } = render(props({ form: 'eligible' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
