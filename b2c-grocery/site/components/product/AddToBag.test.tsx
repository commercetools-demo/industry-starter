import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { makeProduct, makeVariant } from '@/test/product';
import { AddToBag } from './AddToBag';

const variant = (over: Partial<ReturnType<typeof makeVariant>> = {}) =>
  makeVariant({ sku: 'MILK-1L', availability: { isOnStock: true, availableQuantity: 5 }, ...over });
const product = makeProduct({ id: 'p-milk', name: 'Whole milk' });

const bodyOf = (call: unknown[]): { sku: string; quantity: number } => JSON.parse(String((call[1] as RequestInit).body));
const posts = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');

function stubFetch(handler: (init?: RequestInit) => { body: unknown; status?: number }) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { body, status = 200 } = handler(init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('AddToBag', () => {
  it('Add three: the mutation is called once with quantity 3 and one toast appears', async () => {
    const after = makeCart({ lines: [cartLine({ sku: 'MILK-1L', quantity: 3 })] });
    const fetchMock = stubFetch((init) => ({ body: { cart: init?.method === 'POST' ? after : null } }));
    renderWithCart(<AddToBag product={product} variant={variant()} />);
    const increase = screen.getByRole('button', { name: 'Increase quantity' });
    await userEvent.click(increase);
    await userEvent.click(increase);
    expect(within(screen.getByRole('group', { name: 'Quantity' })).getByRole('status')).toHaveTextContent('3');
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findAllByText('Added to your bag')).toHaveLength(1);
    expect(posts(fetchMock)).toHaveLength(1);
    expect(bodyOf(posts(fetchMock)[0])).toEqual({ sku: 'MILK-1L', quantity: 3 });
  });

  it('quantity stays between 1 and the available quantity', async () => {
    renderWithCart(<AddToBag product={product} variant={variant({ availability: { isOnStock: true, availableQuantity: 2 } })} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(within(screen.getByRole('group', { name: 'Quantity' })).getByRole('status')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('Out of stock: the button is disabled with aria-disabled, the text says so, nothing is sent', async () => {
    const fetchMock = stubFetch(() => ({ body: { cart: null } }));
    renderWithCart(<AddToBag product={product} variant={variant({ availability: { isOnStock: false, availableQuantity: 0 } })} />);
    const button = screen.getByRole('button', { name: 'Add to bag' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Out of stock');
    await userEvent.click(button);
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('Ask for more than available: units already in the bag count, nothing is sent and the limit is shown', async () => {
    const cart = makeCart({ lines: [cartLine({ sku: 'MILK-1L', quantity: 2 })] });
    const fetchMock = stubFetch(() => ({ body: { cart } }));
    renderWithCart(<AddToBag product={product} variant={variant({ availability: { isOnStock: true, availableQuantity: 3 } })} />, { cart });
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Only 3 available');
    expect(posts(fetchMock)).toHaveLength(0);
    expect(screen.queryByText('Added to your bag')).toBeNull();
  });

  it('INSUFFICIENT_STOCK from the server: "Only 3 available" shows and the cart does not change', async () => {
    stubFetch((init) => (init?.method === 'POST' ? { body: { error: 'INSUFFICIENT_STOCK', available: 3 }, status: 409 } : { body: { cart: null } }));
    renderWithCart(<AddToBag product={product} variant={variant({ availability: { isOnStock: true, availableQuantity: 9 } })} />, { cart: null });
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findByText('Only 3 available right now.')).toBeInTheDocument();
    expect(screen.queryByText('Added to your bag')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to bag' })).toBeEnabled());
  });

  it('the heart is present', () => {
    renderWithCart(<AddToBag product={product} variant={variant()} />);
    expect(screen.getByRole('button', { name: 'Save Whole milk to a list' })).toBeInTheDocument();
  });

  it('German labels', () => {
    renderWithCart(<AddToBag product={product} variant={variant()} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'In den Warenkorb' })).toBeInTheDocument();
  });
});
