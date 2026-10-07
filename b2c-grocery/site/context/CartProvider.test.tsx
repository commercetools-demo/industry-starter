import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, makeCart, renderWithCart } from '@/test/cart';
import { useCartContext } from './CartProvider';

function AddButton() {
  const { addItemWithToast, itemCount } = useCartContext();
  return (
    <>
      <button onClick={() => void addItemWithToast('MILK-1L', 2)}>add</button>
      <span data-testid="count">{itemCount}</span>
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('CartProvider', () => {
  it('Add-to-bag toast: shows "Added to your bag" with a "View bag" link and updates the count', async () => {
    const cart = makeCart();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ cart })));
    renderWithCart(<AddButton />, { cart: null });
    fireEvent.click(screen.getByText('add'));
    expect(await screen.findByText('Added to your bag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View bag' })).toHaveAttribute('href', expect.stringContaining('/cart'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });

  it('Insufficient stock: the message shows the available quantity and no success toast', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ error: 'INSUFFICIENT_STOCK', available: 3 }, 409)));
    renderWithCart(<AddButton />, { cart: null });
    fireEvent.click(screen.getByText('add'));
    expect(await screen.findByText('Only 3 available right now.')).toBeInTheDocument();
    expect(screen.queryByText('Added to your bag')).not.toBeInTheDocument();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('Out of stock (available 0): a plain out-of-stock message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ error: 'INSUFFICIENT_STOCK', available: 0 }, 409)));
    renderWithCart(<AddButton />, { cart: null });
    fireEvent.click(screen.getByText('add'));
    expect(await screen.findByText('Sorry, this item is out of stock.')).toBeInTheDocument();
  });

  it('Other failures: generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(jsonResponse({ error: 'CART_ERROR' }, 500)));
    renderWithCart(<AddButton />, { cart: null });
    fireEvent.click(screen.getByText('add'));
    expect(await screen.findByText('We could not update your bag. Please try again.')).toBeInTheDocument();
  });

  it('useCartContext outside the provider throws a clear error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<AddButton />)).toThrow('useCartContext must be used inside <CartProvider>');
    spy.mockRestore();
  });
});
