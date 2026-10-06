import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@/lib/types';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { CartView } from './CartView';

vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

type Handler = (url: string, init?: RequestInit) => { body: unknown; status?: number };

/** Stubs `fetch` with a handler that plays the server (keep server state in the test so revalidation sees it). */
function stubFetch(handler: Handler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const { body, status = 200 } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const bananas = cartLine({ id: 'line-b', sku: 'BANANAS-500G', name: 'Bananas', quantity: 2, total: { centAmount: 298, currencyCode: 'USD' }, availableQuantity: 50 });
const milk = cartLine({ id: 'line-m', sku: 'MILK-1L', name: 'Whole milk 1 L', quantity: 1, total: { centAmount: 199, currencyCode: 'USD' } });

afterEach(() => vi.unstubAllGlobals());

describe('CartView', () => {
  it('Desktop bag: heading, lines with price and stock tag, and the summary with server totals', () => {
    const cart = makeCart({
      lines: [bananas, milk],
      shipping: { name: 'Standard', price: { centAmount: 399, currencyCode: 'USD' }, free: false },
      total: { centAmount: 896, currencyCode: 'USD' },
    });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByRole('heading', { level: 1, name: 'Your bag' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('heading', { level: 3, name: 'Bananas' })).toBeInTheDocument();
    expect(within(rows[0]).getByText('$2.98')).toBeInTheDocument();
    expect(within(rows[0]).getByText('In stock')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    const summary = screen.getByRole('heading', { level: 3, name: 'Summary' }).closest('div') as HTMLElement;
    expect(within(summary).getByText('$4.97')).toBeInTheDocument(); // subtotal: sum of line totals
    expect(within(summary).getByText('$3.99')).toBeInTheDocument(); // delivery from the server
    expect(within(summary).getByText('$8.96')).toBeInTheDocument(); // total is the server's, not recomputed
  });

  it('Free delivery: reads "Included"', () => {
    const cart = makeCart({ lines: [milk], shipping: { price: { centAmount: 0, currencyCode: 'USD' }, free: true } });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByText('Included')).toBeInTheDocument();
  });

  it('No shipping chosen yet: delivery says it is calculated at checkout', () => {
    const cart = makeCart({ lines: [milk] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByText('Calculated at checkout')).toBeInTheDocument();
  });

  it('Checkout is disabled until there is an address (Q), with the explanation text', () => {
    const cart = makeCart({ lines: [milk] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    const checkout = screen.getByRole('button', { name: 'Checkout' });
    expect(checkout).toBeDisabled();
    expect(checkout).toHaveAccessibleDescription('Add a delivery address to continue.');
  });

  it('Out of stock line: inline notice, "Out of stock" tag and Checkout disabled with the reason', () => {
    const cart = makeCart({ lines: [cartLine({ inStock: false, availableQuantity: 0 })] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('out of stock right now');
    const checkout = screen.getByRole('button', { name: 'Checkout' });
    expect(checkout).toBeDisabled();
    expect(checkout).toHaveAccessibleDescription('Remove the unavailable items to continue.');
  });

  it('Increase quantity: PATCHes the line and shows the server totals', async () => {
    const cart = makeCart({ lines: [bananas] });
    const updated: Cart = makeCart({ lines: [{ ...bananas, quantity: 3, total: { centAmount: 447, currencyCode: 'USD' } }] });
    let server: Cart = cart;
    const fetchMock = stubFetch((_url, init) => {
      if (init?.method === 'PATCH') server = updated;
      return { body: { cart: server } };
    });
    renderWithCart(<CartView />, { cart });
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Bananas' }));
    // line total, subtotal and total all show the server's new amount
    expect((await screen.findAllByText('$4.47')).length).toBeGreaterThanOrEqual(3);
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch?.[0]).toBe('/api/cart/line-items/line-b');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ quantity: 3 });
  });

  it('Increase quantity fails: reverts to the server quantity and shows the available stock', async () => {
    const cart = makeCart({ lines: [bananas] });
    stubFetch((_url, init) => (init?.method === 'PATCH' ? { body: { error: 'INSUFFICIENT_STOCK', available: 2 }, status: 409 } : { body: { cart } }));
    renderWithCart(<CartView />, { cart });
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Bananas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only 2 available right now.');
    await waitFor(() => expect(screen.getByRole('group', { name: 'Quantity of Bananas' })).toHaveTextContent('2'));
    expect(within(screen.getByRole('listitem')).getByText('$2.98')).toBeInTheDocument();
  });

  it('stepper cannot go above the available quantity', () => {
    const cart = makeCart({ lines: [{ ...bananas, quantity: 5, availableQuantity: 5 }] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByRole('button', { name: 'Increase quantity of Bananas' })).toBeDisabled();
  });

  it('Remove line: the line disappears and an undo toast is offered; Undo re-adds the sku and quantity', async () => {
    const cart = makeCart({ lines: [bananas, milk] });
    const without: Cart = makeCart({ lines: [milk] });
    let server: Cart = cart;
    const fetchMock = stubFetch((_url, init) => {
      if (init?.method === 'DELETE') server = without;
      if (init?.method === 'POST') server = cart;
      return { body: { cart: server } };
    });
    renderWithCart(<CartView />, { cart });
    const row = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Removed from your bag')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Bananas' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/cart/line-items');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ sku: 'BANANAS-500G', quantity: 2 });
    expect(await screen.findByRole('heading', { level: 3, name: 'Bananas' })).toBeInTheDocument();
  });

  it('Empty: the last removed line shows the empty message and a browse link, and Checkout is gone', async () => {
    const cart = makeCart({ lines: [milk] });
    let server: Cart | null = cart;
    stubFetch((_url, init) => {
      if (init?.method === 'DELETE') server = null;
      return { body: { cart: server } };
    });
    renderWithCart(<CartView />, { cart });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Your bag is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', expect.stringContaining('/shop'));
    expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
  });

  it('Empty bag from the start (no cart)', () => {
    stubFetch(() => ({ body: { cart: null } }));
    renderWithCart(<CartView />, { cart: null });
    expect(screen.getByText('Your bag is empty.')).toBeInTheDocument();
  });

  it('German: heading and checkout label are translated', () => {
    const cart = makeCart({ lines: [milk] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart, locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Dein Warenkorb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zur Kasse' })).toBeDisabled();
  });

  it('Each line has a substitution control showing its saved preference', () => {
    const cart = makeCart({ lines: [{ ...bananas, substitutionPreference: 'allow-similar' }, milk] });
    stubFetch(() => ({ body: { cart } }));
    renderWithCart(<CartView />, { cart });
    expect(screen.getByRole('radiogroup', { name: 'Substitution for Bananas' })).toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup', { name: 'Substitution for Bananas' })).getByRole('radio', { name: 'Allow similar' })).toBeChecked();
    expect(within(screen.getByRole('radiogroup', { name: 'Substitution for Whole milk 1 L' })).getByRole('radio', { name: 'No substitution' })).toBeChecked();
  });
});
