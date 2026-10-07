import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSWR from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import type { BundleMoveResult, SavedListDetail, SavedListLine } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { ListDetail } from './ListDetail';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const line = (id: string, over: Partial<SavedListLine> = {}): SavedListLine => ({
  lineId: id, offerKey: `o-${id}`, name: `Name ${id}`, term: '24-months', variantLabel: '', quantity: 1, saved: usd(5999), current: usd(5999), recurring: true,
  delta: { status: 'same', deltaCents: 0 }, available: true, ...over,
});
const detail = (...lines: SavedListLine[]): SavedListDetail => ({ id: 'l1', name: 'Home setup', lines });

let calls: Array<{ url: string; method: string }>;
let moveAnswer: BundleMoveResult;
beforeEach(() => {
  push.mockClear();
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.endsWith('/add-to-bundle')) return new Response(JSON.stringify(moveAnswer), { status: 200 });
      return new Response(JSON.stringify({ list: detail() }), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function CartProbe() {
  const { data } = useSWR<{ id: string } | null>(KEY_CART, null);
  return <p data-testid="cart">{data?.id ?? 'none'}</p>;
}

describe('ListDetail', () => {
  it('shows the name as heading, each line with its term, quantity and the price now per month', () => {
    renderWithProviders(<ListDetail initial={detail(line('a', { quantity: 2 }))} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Home setup' })).toBeInTheDocument();
    expect(screen.getAllByText('Name a').length).toBeGreaterThan(0);
    expect(screen.getByText('24-month price lock')).toBeInTheDocument();
    expect(screen.getByText('Quantity 2')).toBeInTheDocument();
    expect(screen.getByText('$59.99/mo')).toBeInTheDocument();
    expect(screen.queryByText(/Price changed/)).not.toBeInTheDocument();
  });

  it('shows a price-changed badge for a price that went up or down and none for an unchanged price', () => {
    renderWithProviders(
      <ListDetail
        initial={detail(
          line('up', { saved: usd(5499), current: usd(5999), delta: { status: 'up', deltaCents: 500 } }),
          line('down', { saved: usd(6499), current: usd(5999), delta: { status: 'down', deltaCents: -500 } }),
          line('same'),
        )}
      />,
    );
    expect(screen.getByText('Price changed: was $54.99, now $59.99 (+$5.00)')).toBeInTheDocument();
    expect(screen.getByText('Price changed: was $64.99, now $59.99 (−$5.00)')).toBeInTheDocument();
    expect(screen.getAllByText(/Price changed/)).toHaveLength(2);
  });

  it('greys a line that is no longer available, shows no price and keeps the add-all button for the others', () => {
    renderWithProviders(<ListDetail initial={detail(line('a'), line('gone', { available: false, current: null, delta: { status: 'unknown', deltaCents: 0 }, reason: 'NOT_PUBLISHED' }))} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[1] as HTMLElement).getByText('No longer available.')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add all to My bundle' })).toBeEnabled();
  });

  it('disables add-all when no line is available', () => {
    renderWithProviders(<ListDetail initial={detail(line('gone', { available: false, current: null }))} />);
    expect(screen.getByRole('button', { name: 'Add all to My bundle' })).toBeDisabled();
  });

  it('add-all result panel lists what was added and every skipped line with its reason, and the list is shown unchanged', async () => {
    const user = userEvent.setup();
    moveAnswer = {
      added: [{ lineId: 'a', offerKey: 'o-a', name: 'Name a' }],
      skipped: [
        { lineId: 'b', offerKey: 'o-b', name: 'Spotify', reason: { code: 'NO_LONGER_AVAILABLE', message: 'No longer available.' } },
        { lineId: 'c', offerKey: 'o-c', name: 'Router', reason: { code: 'PARENT_REQUIRED', message: 'Refused', messageKey: 'offers.reason.PARENT_REQUIRED', params: {} } },
        { lineId: 'd', offerKey: 'o-d', name: 'Phone', reason: { code: 'INSUFFICIENT_STOCK', message: 'Not enough stock.' } },
      ],
      cart: { id: 'cart-7', lines: [] } as never,
    };
    renderWithProviders(
      <>
        <CartProbe />
        <ListDetail initial={detail(line('a'), line('b'), line('c'), line('d'))} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Add all to My bundle' }));
    const panel = (await screen.findByText('1 item added to My bundle.')).closest('section') as HTMLElement;
    expect(within(panel).getByText('1 item added to My bundle.')).toBeInTheDocument();
    expect(within(panel).getByText('Spotify: No longer available.')).toBeInTheDocument();
    expect(within(panel).getByText('Router: Add a plan first.')).toBeInTheDocument();
    expect(within(panel).getByText('Phone: Not enough stock.')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'View My bundle' })).toHaveAttribute('href', '/en-US/bundle');
    expect(screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-line-id'))).toHaveLength(4);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['POST /api/account/lists/l1/add-to-bundle']);
    await waitFor(() => expect(screen.getByTestId('cart')).toHaveTextContent('cart-7'));
  });

  it('removes a line through the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListDetail initial={detail(line('a'))} />);
    await user.click(screen.getByRole('button', { name: /^Remove/ }));
    await waitFor(() => expect(calls).toEqual([{ url: '/api/account/lists/l1/lines/a', method: 'DELETE' }]));
  });

  it('confirms before deleting the list, then goes back to the lists', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListDetail initial={detail(line('a'))} />);
    await user.click(screen.getByRole('button', { name: 'Delete list' }));
    expect(await screen.findByText('Delete this list?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/lists'));
    expect(calls[0]).toEqual({ url: '/api/account/lists/l1', method: 'DELETE' });
  });
});
