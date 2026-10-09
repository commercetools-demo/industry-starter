import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import type { Cart, CartLine, Money } from '@/lib/types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import { CartPage } from './CartPage';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const line = (id: string, name: string, cents: number, over: Partial<CartLine> = {}): CartLine => ({
  id,
  sku: `SKU-${id}`,
  name: { 'en-US': name },
  rxNumber: 'RX-77102',
  rxLineRef: `RX-77102-${id}`,
  prescribedQty: 30,
  unitPrice: usd(cents),
  totalPrice: usd(cents),
  priceUpdated: false,
  ...over,
});
const cartOf = (lines: CartLine[], over: Partial<Cart> = {}): Cart => ({
  id: 'c1',
  version: 1,
  itemCount: lines.length,
  lineCount: lines.length,
  currencyCode: 'USD',
  lines,
  subtotal: lines.length ? usd(3015) : null,
  shipping: { name: 'Standard delivery', price: usd(0) },
  total: usd(3015),
  unavailableCount: lines.filter((l) => l.unavailable).length,
  ...over,
});
const ATOR = line('1', 'Atorvastatin 20 mg tablets', 1875);
const LIS = line('2', 'Lisinopril 10 mg tablets', 1140);

let current: Cart | null;
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  setPathname('/en-US/cart');
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop() ?? '');
      const rest = (current?.lines ?? []).filter((l) => l.id !== id);
      // The platform recalculates: the fake answers with totals for the remaining lines.
      current = cartOf(rest, { subtotal: rest.length ? usd(1140) : null, total: usd(rest.length ? 1140 : 0) });
      return json({ cart: current });
    }
    return json(current);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function show(cart: Cart | null) {
  current = cart;
  const view = renderWithProviders(<CartPage />);
  await waitFor(() => expect(screen.queryByLabelText('Loading your cart')).toBeNull());
  return view;
}

describe('design-cart › Cart page layout', () => {
  it('Lines: name, "<RX number> · Qty N", the price and a Remove button on every row', async () => {
    await show(cartOf([ATOR, LIS]));
    expect(screen.getByRole('heading', { level: 1, name: 'Your cart' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Atorvastatin 20 mg tablets')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('RX-77102 · Qty 30')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('$18.75')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('button', { name: 'Remove Atorvastatin 20 mg tablets from your cart' })).toBeInTheDocument();
  });

  it('Summary: Subtotal, Standard delivery with a FREE badge, Total, and a Checkout link to /checkout', async () => {
    await show(cartOf([ATOR, LIS]));
    const summary = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(summary).getByText('Subtotal')).toBeInTheDocument();
    expect(within(summary).getByText('$30.15', { selector: '[data-subtotal]' })).toBeInTheDocument();
    expect(within(summary).getByText('Standard delivery')).toBeInTheDocument();
    expect(within(summary).getByText('FREE')).toHaveAttribute('data-variant', 'ok');
    expect(within(summary).getByText('$30.15', { selector: '[data-total]' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Checkout' }).getAttribute('href')).toContain('/checkout');
  });

  it('Summary: a calculated delivery fee replaces the FREE badge', async () => {
    await show(cartOf([ATOR], { shipping: { name: 'Same-day delivery', price: usd(500) }, total: usd(2375) }));
    expect(screen.queryByText('FREE')).toBeNull();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('$23.75', { selector: '[data-total]' })).toBeInTheDocument();
  });

  it('Summary: the total shown is exactly the platform total, not a figure derived from the lines', async () => {
    await show(cartOf([ATOR, LIS], { total: usd(9999), subtotal: usd(8888) }));
    expect(screen.getByText('$99.99', { selector: '[data-total]' })).toBeInTheDocument();
    expect(screen.getByText('$88.88', { selector: '[data-subtotal]' })).toBeInTheDocument();
  });

  it('Empty cart: only the lines card with "Your cart is empty." and Find a prescription, no summary', async () => {
    await show(cartOf([]));
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a prescription' }).getAttribute('href')).toContain('/prescriptions');
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByText('Subtotal')).toBeNull();
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('no cart at all is the empty state too', async () => {
    await show(null);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('a failed load shows an error with a retry, not an empty cart', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Something went wrong. Please try again.' }, 500));
    current = null;
    renderWithProviders(<CartPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your cart.');
    expect(screen.queryByText('Your cart is empty.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('design-cart › Remove lines with prices recalculated', () => {
  it('Remove: the line goes, the totals come from the server answer, and "Removed <name>" is announced', async () => {
    const user = userEvent.setup();
    await show(cartOf([ATOR, LIS]));
    await user.click(screen.getByRole('button', { name: 'Remove Atorvastatin 20 mg tablets from your cart' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.queryByText('Atorvastatin 20 mg tablets')).toBeNull();
    expect(screen.getByText('$11.40', { selector: '[data-total]' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Removed Atorvastatin 20 mg tablets');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/cart/lines/1' && (c[1] as RequestInit).method === 'DELETE')).toBe(true);
  });

  it('Quantity changed (remove path): the cart is re-read from the server after the change', async () => {
    const user = userEvent.setup();
    await show(cartOf([ATOR, LIS]));
    fetchMock.mockClear();
    await user.click(screen.getByRole('button', { name: /Remove Lisinopril/ }));
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/cart')).not.toHaveLength(0));
  });

  it('Last line removed: the empty state shows', async () => {
    const user = userEvent.setup();
    await show(cartOf([ATOR]));
    await user.click(screen.getByRole('button', { name: /Remove Atorvastatin/ }));
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('a failed removal keeps the line and says so', async () => {
    const user = userEvent.setup();
    await show(cartOf([ATOR, LIS]));
    fetchMock.mockResolvedValueOnce(json({ error: 'Something went wrong. Please try again.' }, 500));
    await user.click(screen.getByRole('button', { name: /Remove Atorvastatin/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not remove that item.');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('design-cart › Lines that stopped being dispensable', () => {
  it.each([
    [{ reason: 'EXPIRED' as const }, 'This prescription has expired'],
    [{ reason: 'NO_REFILLS' as const }, 'No refills left'],
    [{ reason: 'OUT_OF_STOCK' as const }, 'Out of stock'],
    [{ reason: 'CEILING' as const, scope: 'period' as const, ceiling: 2 }, 'Monthly limit of 2 reached'],
    [{ reason: 'CEILING' as const, scope: 'order' as const, ceiling: 2 }, 'Limit of 2 per order'],
    [{ reason: 'UNAVAILABLE' as const }, 'This prescription can no longer be filled'],
  ])('Prescription expired or refills used: %j shows its reason', async (unavailable, text) => {
    await show(cartOf([line('1', 'Atorvastatin 20 mg tablets', 1875, { unavailable }), LIS]));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('Prescription expired or refills used: the row is struck through, Checkout is disabled until it is removed', async () => {
    const user = userEvent.setup();
    await show(cartOf([line('1', 'Atorvastatin 20 mg tablets', 1875, { unavailable: { reason: 'EXPIRED' } }), LIS]));
    const struck = screen.getByText('Atorvastatin 20 mg tablets');
    expect(struck.className).toContain('line-through');
    const checkout = screen.getByRole('button', { name: 'Fix 1 item to continue' });
    expect(checkout).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
    expect(screen.getByText(/1 unavailable item not included/)).toBeInTheDocument();
    // The line can still be removed; the server then answers with a cart that has nothing to fix.
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => json(init?.method === 'DELETE' ? { cart: cartOf([LIS]) } : cartOf([LIS])));
    await user.click(screen.getByRole('button', { name: /Remove Atorvastatin/ }));
    expect(await screen.findByRole('link', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('the SHELF_LIFE reason names the expiry date', async () => {
    await show(cartOf([line('1', 'Famotidine', 700, { unavailable: { reason: 'SHELF_LIFE', expiryDate: '2026-11-15' } })]));
    expect(screen.getByText(/Stock expires .*2026.*, too soon/)).toBeInTheDocument();
  });

  it('Fix N items: the count follows the number of flagged lines', async () => {
    await show(cartOf([line('1', 'A', 100, { unavailable: { reason: 'EXPIRED' } }), line('2', 'B', 100, { unavailable: { reason: 'EXPIRED' } })]));
    expect(screen.getByRole('button', { name: 'Fix 2 items to continue' })).toBeDisabled();
  });

  it('Price changed: the new price shows with a "Price updated" note', async () => {
    await show(cartOf([line('1', 'Atorvastatin 20 mg tablets', 2000, { priceUpdated: true }), LIS]));
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Price updated')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('$20.00')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Price updated')).toBeNull();
  });
});

describe('design-cart › No quantity editing', () => {
  it('Quantity shown read-only: "Qty 21" is text and there is no quantity control', async () => {
    await show(cartOf([line('1', 'Amoxicillin 500 mg capsules', 1500, { prescribedQty: 21, rxNumber: 'RX-48213' })]));
    expect(screen.getByText('RX-48213 · Qty 21')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /increase|decrease|quantity|plus|minus/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1); // Remove only
  });
});
