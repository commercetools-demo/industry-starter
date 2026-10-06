import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCart } from '@/test/cart';
import { renderWithCart } from '@/test/cart';
import { makeProduct, makeVariant } from '@/test/product';
import type { Product } from '@/lib/types';
import { SavedView } from './SavedView';

const user = { id: 'c-1', email: 'a@b.c', firstName: 'A', lastName: 'B' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const bananas = makeProduct({ id: 'p-1', name: 'Bananas', slug: 'bananas', brand: 'Finca Verde' });
const milk = makeProduct({
  id: 'p-2',
  name: 'Whole milk',
  slug: 'whole-milk',
  brand: 'Hof',
  variants: [makeVariant({ sku: 'MILK-1L', availability: { isOnStock: false, availableQuantity: 0 } })],
});
const cheese = makeProduct({
  id: 'p-3',
  name: 'Cheddar',
  slug: 'cheddar',
  variants: [makeVariant({ id: 1, sku: 'CHED-200' }), makeVariant({ id: 2, sku: 'CHED-400' })],
});

/** Stateful wishlist: DELETE removes the id like the server does. */
function stubApi(products: Product[], { deleteStatus = 200, productsStatus = 200 }: { deleteStatus?: number; productsStatus?: number } = {}) {
  let ids = products.map((p) => p.id);
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return json({ user });
    if (url === '/api/cart/line-items' && init?.method === 'POST') return json({ cart: makeCart() });
    if (url === '/api/cart') return json({ cart: null });
    if (url.startsWith('/api/account/wishlist/products')) return productsStatus === 200 ? json({ products }) : json({ error: 'WISHLIST_ERROR' }, productsStatus);
    if (init?.method === 'DELETE') {
      if (deleteStatus !== 200) return json({ error: 'WISHLIST_ERROR' }, deleteStatus);
      ids = ids.filter((id) => id !== decodeURIComponent(url.split('/').pop() ?? ''));
      return json({ productIds: ids });
    }
    if (url === '/api/account/wishlist') return json({ productIds: ids });
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const renderView = () =>
  renderWithCart(
    <SWRConfig value={{ fallback: { account: user } }}>
      <SavedView />
    </SWRConfig>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('SavedView', () => {
  it('Count label: "N pieces saved" kicker above the H1 "Put aside"', async () => {
    stubApi([bananas, milk, cheese]);
    renderView();
    expect(await screen.findByText('3 pieces saved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Put aside' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('count is singular for one item', async () => {
    stubApi([bananas]);
    renderView();
    expect(await screen.findByText('1 piece saved')).toBeInTheDocument();
  });

  it('Empty list: the empty message and a browse button, no count', async () => {
    stubApi([]);
    renderView();
    expect(await screen.findByText(/Nothing put aside yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.queryByText(/saved$/)).not.toBeInTheDocument();
  });

  it('Move to bag: a single in-stock variant is added to the bag', async () => {
    const fetchMock = stubApi([bananas]);
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Bananas to your bag' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/cart/line-items' && init?.method === 'POST')).toBe(true));
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/cart/line-items');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ sku: 'BANANAS-1KG', quantity: 1 });
    expect(await screen.findByText('Added to your bag')).toBeInTheDocument();
  });

  it('Multiple variants: "Add to bag" is a link to the product page and adds nothing', async () => {
    const fetchMock = stubApi([cheese]);
    renderView();
    const link = await screen.findByRole('link', { name: 'Choose options for Cheddar' });
    expect(link).toHaveAttribute('href', '/en-US/p/cheddar');
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/cart/line-items')).toBe(false);
  });

  it('Out of stock saved item: the button is disabled and labelled "Out of stock"', async () => {
    stubApi([milk]);
    renderView();
    const button = await screen.findByRole('button', { name: 'Out of stock' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Add Whole milk/ })).not.toBeInTheDocument();
  });

  it('Remove: the card goes at once, DELETE is sent, the last removal shows the empty state', async () => {
    const fetchMock = stubApi([bananas]);
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Bananas from your saved items' }));
    expect(await screen.findByText(/Nothing put aside yet/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/account/wishlist/p-1' && init?.method === 'DELETE')).toBe(true);
  });

  it('Remove failing: the card comes back and a message is shown', async () => {
    stubApi([bananas, cheese], { deleteStatus: 500 });
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Bananas from your saved items' }));
    expect(await screen.findByText('We could not remove that item. Please try again.')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Saved items' });
    expect(within(list).getByText('Bananas')).toBeInTheDocument();
  });

  it('Load failure: an alert with a retry button', async () => {
    stubApi([bananas], { productsStatus: 500 });
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your saved items.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('German: the heading and the count use the de-DE messages', async () => {
    stubApi([bananas, milk]);
    renderWithCart(
      <SWRConfig value={{ fallback: { account: user } }}>
        <SavedView />
      </SWRConfig>,
      { locale: 'de-DE' },
    );
    expect(await screen.findByText('2 Stücke gemerkt')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Zur Seite gelegt' })).toBeInTheDocument();
  });
});
