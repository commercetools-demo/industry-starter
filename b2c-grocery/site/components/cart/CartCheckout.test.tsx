import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { CartView } from './CartView';

const push = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push, refresh: vi.fn() }),
}));

const future = () => new Date(Date.now() + 10 * 60_000).toISOString();
const readyCart = (over = {}) =>
  makeCart({
    shippingAddress: { country: 'US', postalCode: '10001', streetName: 'Main St 1', city: 'New York' },
    slot: { id: '20261013-10', start: '2026-10-13T10:00:00.000Z', end: '2026-10-13T12:00:00.000Z', holdExpires: future() },
    ...over,
  });

/** What the server answers on revalidation: always the cart the test seeded (a different one would race the click). */
let server = readyCart();
const render = (ui: Parameters<typeof renderWithCart>[0], cart: ReturnType<typeof readyCart>) => {
  server = cart;
  return renderWithCart(ui, { cart });
};

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/slots' ? { days: [] } : { cart: server }), { status: 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('cart checkout button (V-06)', () => {
  it('Ready cart: Checkout is enabled and opens /checkout', async () => {
    render(<CartView />, readyCart());
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(push).toHaveBeenCalledWith('/checkout');
  });

  it('Missing slot: Checkout is disabled and nothing is pushed', async () => {
    render(<CartView />, readyCart({ slot: undefined }));
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(push).not.toHaveBeenCalled();
  });

  it('Missing address: Checkout is disabled', () => {
    render(<CartView />, readyCart({ shippingAddress: undefined }));
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
  });
});

describe('checkout error banner (V-06)', () => {
  it.each([
    ['SLOT_FULL', 'That delivery slot just filled. Please pick another one.'],
    ['UNAVAILABLE_LINES', 'Some items are no longer available in the quantity you chose. Please update your bag.'],
    ['NO_ADDRESS', 'Please add a delivery address we can deliver to.'],
    ['NO_SLOT', 'Please choose a delivery slot.'],
    ['NETWORK', 'We could not start checkout. Please try again.'],
    ['SOMETHING_ELSE', 'We could not start checkout. Please try again.'],
  ])('%s shows its message', (code, message) => {
    render(<CartView checkoutError={code} />, readyCart({ slot: undefined }));
    expect(screen.getByTestId('checkout-error')).toHaveTextContent(message);
  });

  it('no error code: no banner', () => {
    render(<CartView />, readyCart());
    expect(screen.queryByTestId('checkout-error')).toBeNull();
  });

  it('UNAVAILABLE_LINES marks the lines with too little stock and only those', () => {
    const short = cartLine({ id: 'line-short', name: 'Bananas', quantity: 5, availableQuantity: 2 });
    const fine = cartLine({ id: 'line-fine', name: 'Whole milk 1 L', quantity: 1, availableQuantity: 10 });
    render(<CartView checkoutError="UNAVAILABLE_LINES" />, readyCart({ lines: [short, fine] }));
    const marks = screen.getAllByTestId('line-short');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('Only 2 available right now.');
    expect(marks[0].closest('li')).toHaveAttribute('data-line-id', 'line-short');
  });

  it('other codes do not mark lines', () => {
    const short = cartLine({ quantity: 5, availableQuantity: 2 });
    render(<CartView checkoutError="SLOT_FULL" />, readyCart({ lines: [short] }));
    expect(screen.queryByTestId('line-short')).toBeNull();
  });
});
