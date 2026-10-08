import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import type { ListLineView, ListSummary, ListView } from '@/lib/lists-types';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ refresh, push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

import { ListDetail } from './ListDetail';
import { ListsIndex } from './ListsIndex';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const line = (over: Partial<ListLineView> & Pick<ListLineView, 'id' | 'name'>): ListLineView => ({ sku: `S-${over.id}`, price: usd(1875), savedPrice: usd(1875), priceDeltaCents: null, unavailable: false, ...over });
const view = (lines: ListLineView[]): ListView => ({ id: 'l1', name: 'Monthly medicines', lineCount: lines.length, updatedAt: '2026-10-08T10:00:00Z', lines });

describe('saved-lists › No lists yet', () => {
  it('states the absence plainly and offers a path to create a first list from the cart', async () => {
    renderWithProviders(<ListsIndex lists={[]} />);
    expect(screen.getByText('You have no saved lists yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a prescription' })).toHaveAttribute('href', '/en-US/prescriptions');
    expect(screen.queryByRole('table')).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ id: 'n', name: 'Mine', lineCount: 1, updatedAt: 't' }, 201));
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'List name' }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save my cart as a list' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/lists');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Mine', fromCart: true });
  });

  it('an empty cart or an empty name shows the server sentence', async () => {
    renderWithProviders(<ListsIndex lists={[]} />);
    fetchMock.mockResolvedValueOnce(json({ error: 'Your cart is empty, so there is nothing to save yet.' }, 422));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save my cart as a list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your cart is empty, so there is nothing to save yet.');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lists the lists with their size and a link to each; a failed read says so', () => {
    const lists: ListSummary[] = [{ id: 'a', name: 'Monthly medicines', lineCount: 2, updatedAt: '2026-10-08T10:00:00Z' }];
    const { unmount } = renderWithProviders(<ListsIndex lists={lists} />);
    const card = document.querySelector('[data-list-card]') as HTMLElement;
    expect(within(card).getByRole('link', { name: 'Monthly medicines' })).toHaveAttribute('href', '/en-US/account/lists/a');
    expect(within(card).getByText(/2 medicines/)).toBeInTheDocument();
    unmount();
    renderWithProviders(<ListsIndex lists={null} />);
    expect(screen.getByText('We could not load your lists. Please try again.')).toBeInTheDocument();
  });
});

describe('saved-lists › List converted in one operation / Line no longer purchasable (page)', () => {
  it('Add all makes one request, shows what went in and NAMES what could not be added with the reason', async () => {
    fetchMock.mockImplementation(async () => json({ added: ['Atorvastatin'], notAdded: [{ name: 'Lisinopril', reason: 'NO_REFILLS' }] }));
    renderWithProviders(<ListDetail list={view([line({ id: '1', name: 'Atorvastatin' }), line({ id: '2', name: 'Lisinopril' })])} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add all to cart' }));
    const notice = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-add-all-result]');
      if (!el) throw new Error('none');
      return el;
    });
    expect(notice).toHaveTextContent('Added to your cart: Atorvastatin.');
    expect(notice.querySelector('[data-not-added]')).toHaveTextContent('Not added: Lisinopril (no refills left).');
    expect(within(notice).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en-US/cart');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('add-all-to-cart'))).toHaveLength(1);
  });

  it('nothing could be added: says so and names every line, no cart link', async () => {
    fetchMock.mockImplementation(async () => json({ added: [], notAdded: [{ name: 'Lisinopril', reason: 'UNAVAILABLE' }] }));
    renderWithProviders(<ListDetail list={view([line({ id: '2', name: 'Lisinopril' })])} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add all to cart' }));
    const notice = await screen.findByText('None of these medicines can be added right now.');
    expect(notice.closest('[data-add-all-result]')).toHaveTextContent('Lisinopril (no longer available)');
    expect(screen.queryByRole('link', { name: 'View cart' })).toBeNull();
  });

  it('a failed request shows an alert, not a notice', async () => {
    fetchMock.mockImplementation(async () => json({ error: 'x' }, 500));
    renderWithProviders(<ListDetail list={view([line({ id: '1', name: 'A' })])} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add all to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not add this list to your cart.');
    expect(document.querySelector('[data-add-all-result]')).toBeNull();
  });
});

describe('saved-lists: list detail prices and lines', () => {
  it('shows the price now and the delta when the price moved since saving (never silent), and flags an unavailable line', () => {
    renderWithProviders(
      <ListDetail
        list={view([
          line({ id: '1', name: 'Atorvastatin', price: usd(2000), savedPrice: usd(1875), priceDeltaCents: 125 }),
          line({ id: '2', name: 'Lisinopril', price: usd(1000), savedPrice: usd(1140), priceDeltaCents: -140 }),
          line({ id: '3', name: 'Gone', price: null, unavailable: true }),
        ])}
      />,
    );
    const rows = document.querySelectorAll('[data-list-line]');
    expect(rows[0]).toHaveTextContent('Price now: $20.00');
    expect(rows[0]).toHaveTextContent('Up $1.25 since you saved it.');
    expect(rows[1]).toHaveTextContent('Down $1.40 since you saved it.');
    expect(rows[2]).toHaveTextContent('No longer available to order');
    expect(rows[2]).not.toHaveTextContent('Price now');
  });

  it('removes a line and refreshes; an empty list says it has no medicines', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'l1', name: 'x', lineCount: 0, updatedAt: 't' }));
    const { unmount } = renderWithProviders(<ListDetail list={view([line({ id: '1', name: 'Atorvastatin' })])} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Atorvastatin from the list' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/lists/l1/lines/1');
    unmount();
    renderWithProviders(<ListDetail list={view([])} />);
    expect(screen.getByText('This list has no medicines yet. Save them from a prescription.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add all to cart' })).toBeNull();
  });

  it('renames in place and deletes only after a confirmation', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'l1' }));
    renderWithProviders(<ListDetail list={view([line({ id: '1', name: 'A' })])} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'New name' });
    await user.clear(input);
    await user.type(input, 'Winter');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const renameInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(renameInit.body as string)).toEqual({ name: 'Winter' });

    await user.click(screen.getByRole('button', { name: 'Delete list' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/lists'));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
