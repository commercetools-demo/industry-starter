import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireSignIn } from '@/components/layout/RequireSignIn';
import { reasonForPath } from '@/lib/sign-in-reason';
import type { Address, CheckoutState } from '@/lib/types';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import { CheckoutPage } from './CheckoutPage';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));
vi.mock('@commercetools/checkout-browser-sdk', () => ({ paymentFlow: vi.fn() }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const ADDRESS = { firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'New York', state: 'NY', zip: '10001', phone: '+15125550100' };
const standard = { key: 'mlv-standard', name: 'Standard delivery', price: usd(0) };
const sameDay = { key: 'mlv-same-day', name: 'Same-day delivery', price: usd(500) };

function state(over: Partial<CheckoutState['cart']> = {}, rest: Partial<CheckoutState> = {}): CheckoutState {
  return {
    cart: {
      id: 'cart-1', version: 3, itemCount: 2, lineCount: 2, currencyCode: 'USD',
      lines: [
        { id: 'l1', sku: 'A', name: { 'en-US': 'Atorvastatin 20 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-1', prescribedQty: 30, unitPrice: usd(1875), totalPrice: usd(1875), priceUpdated: false },
        { id: 'l2', sku: 'B', name: { 'en-US': 'Lisinopril 10 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-2', prescribedQty: 30, unitPrice: usd(1140), totalPrice: usd(1140), priceUpdated: false },
      ],
      subtotal: usd(3015), shipping: { name: 'Standard delivery', price: usd(0) }, total: usd(3015), unavailableCount: 0,
      shippingAddress: ADDRESS, shippingMethodKey: 'mlv-standard', tax: usd(0),
      ...over,
    },
    options: [standard, sameDay],
    deliverable: true,
    paymentMode: 'demo',
    ...rest,
  };
}

let server: { checkout: CheckoutState | null; put: (path: string, body: unknown) => Response };
let calls: { method: string; path: string; body?: unknown }[];
const book: Address[] = [{ id: 'a1', ...ADDRESS, street2: '', country: 'US', isDefault: true }];

beforeEach(() => {
  router.push.mockReset();
  calls = [];
  server = { checkout: state(), put: () => json({}, 404) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      if (path === '/api/auth/me') return json({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
      if (path === '/api/account/addresses') return json({ addresses: book });
      if (path === '/api/checkout' && method === 'GET') return json(server.checkout);
      return server.put(path, body);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const total = () => document.querySelector('[data-total]');

describe('design-checkout: Single-page checkout layout', () => {
  it('Empty cart: says so and links to /prescriptions', async () => {
    server.checkout = null;
    renderWithProviders(<CheckoutPage />);
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a prescription' }).getAttribute('href')).toMatch(/\/prescriptions$/);
    expect(document.querySelector('[data-checkout-card]')).toBeNull();
  });

  it('Empty cart: a cart without lines is the same empty state', async () => {
    server.checkout = state({ lineCount: 0, lines: [] });
    renderWithProviders(<CheckoutPage />);
    expect(await screen.findByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('Anonymous visitor: the route guard shows "Sign in to check out." and returns to checkout afterwards', () => {
    setPathname('/en-US/checkout');
    expect(reasonForPath('/checkout')).toBe('checkout');
    renderWithProviders(<RequireSignIn reason="checkout" />);
    expect(screen.getByText('Sign in to check out.')).toBeInTheDocument();
    const href = screen.getByRole('link', { name: 'Sign in' }).getAttribute('href') ?? '';
    expect(new URL(href, 'http://localhost').searchParams.get('next')).toBe('/en-US/checkout');
  });

  it('three cards in order Delivery address, Delivery speed, Payment, then the summary; the summary is sticky and stacks under 900 px', async () => {
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(screen.getByRole('heading', { name: 'Checkout', level: 1 })).toBeInTheDocument();
    const cards = [...document.querySelectorAll('[data-checkout-card]')].map((c) => c.getAttribute('data-checkout-card'));
    expect(cards).toEqual(['address', 'delivery', 'payment']);
    const summary = document.querySelector('[data-checkout-summary]');
    expect(summary?.className).toContain('nav:sticky');
    expect(summary?.className).toContain('nav:top-24');
    expect(summary?.parentElement?.className).toContain('nav:grid-cols-[1fr_23.75rem]');
  });
});

describe('design-checkout: Place order: summary', () => {
  it('Summary: lists each line, the delivery row, the total in navy 20px bold and a full-width Place order button, all from the cart', async () => {
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    const summary = document.querySelector('[data-checkout-summary]') as HTMLElement;
    const lines = within(summary).getAllByText(/Atorvastatin 20 mg|Lisinopril 10 mg/);
    expect(lines).toHaveLength(2);
    expect(within(summary).getByText('$18.75')).toBeInTheDocument();
    expect(within(summary).getByText('$11.40')).toBeInTheDocument();
    expect(within(summary).getByText('FREE')).toBeInTheDocument();
    expect(total()).toHaveTextContent('$30.15');
    expect(total()?.className).toContain('text-navy-700');
    expect(total()?.className).toContain('text-xl');
    const button = within(summary).getByRole('button', { name: 'Place order' });
    expect(button.className).toContain('w-full');
    expect(button).toBeEnabled();
  });

  it('Place order is disabled with the reason until the cart has an address', async () => {
    server.checkout = state({ shippingAddress: null, shippingMethodKey: null });
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(screen.getByText('Save your delivery address to place your order.')).toBeInTheDocument();
  });

  it('unavailable lines block the order and point back to the cart', async () => {
    const base = state();
    base.cart.lines[0] = { ...base.cart.lines[0], unavailable: { reason: 'NO_REFILLS', remaining: 0 } };
    server.checkout = { ...base, cart: { ...base.cart, unavailableCount: 1 } };
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(screen.getByText(/1 item cannot be filled/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to cart' }).getAttribute('href')).toMatch(/\/cart$/);
  });

  it('shows tax only when the platform charged some', async () => {
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(document.querySelector('[data-tax]')).toBeNull();
  });
});

describe('checkout-page: Checkout re-reading totals after each shipping change', () => {
  it('Address change moves tax: the summary shows the tax, shipping and total from the answer of the address change', async () => {
    const user = userEvent.setup();
    server.put = (path) => (path === '/api/checkout/address' ? json(state({ tax: usd(150), total: usd(3165) })) : json({}, 404));
    renderWithProviders(<CheckoutPage />);
    await screen.findByDisplayValue('12 Elm St');
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    await waitFor(() => expect(document.querySelector('[data-tax]')).toHaveTextContent('$1.50'));
    expect(total()).toHaveTextContent('$31.65');
    expect(calls.find((c) => c.path === '/api/checkout/address')).toMatchObject({ method: 'PUT', body: { street: '12 Elm St', state: 'NY' } });
  });

  it('Change: choosing Same-day shows $5.00 in the delivery row and a total that includes it, from the recalculated cart', async () => {
    const user = userEvent.setup();
    server.put = (path) => (path === '/api/checkout/shipping-method' ? json(state({ shipping: { name: 'Same-day delivery', price: usd(500) }, shippingMethodKey: 'mlv-same-day', total: usd(3515) })) : json({}, 404));
    renderWithProviders(<CheckoutPage />);
    await user.click(await screen.findByRole('radio', { name: /Same-day/ }));
    await waitFor(() => expect(total()).toHaveTextContent('$35.15'));
    expect(document.querySelector('[data-delivery="fee"]')).toHaveTextContent('$5.00');
    expect(calls.find((c) => c.path === '/api/checkout/shipping-method')).toMatchObject({ body: { key: 'mlv-same-day' } });
    expect(screen.getByRole('radio', { name: /Same-day/ })).toBeChecked();
  });

  it('No delivery method for address: a 422 answer shows the message, withdraws the options and disables Place order', async () => {
    const user = userEvent.setup();
    server.put = (path) =>
      path === '/api/checkout/address'
        ? json({ code: 'NO_DELIVERY_METHOD', error: 'x', state: state({ shipping: null, shippingMethodKey: null }, { options: [], deliverable: false }) }, 422)
        : json({}, 404);
    renderWithProviders(<CheckoutPage />);
    await screen.findByDisplayValue('12 Elm St');
    await user.click(screen.getByRole('button', { name: 'Use this address' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled());
    expect(screen.getByText(/We cannot deliver to this address with any delivery option/)).toBeInTheDocument();
    expect(screen.getByText(/No delivery option is available for this address\. Check/)).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('Same-day not available: options without it say why', async () => {
    server.checkout = state({}, { options: [standard] });
    renderWithProviders(<CheckoutPage />);
    expect(await screen.findByText(/Same-day delivery is not available for this order/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Same-day/ })).toBeNull();
  });
});

describe('design-checkout: Place order: success and demo banner', () => {
  it('Success: Place order in the demo build runs the gate, the demo Checkout and the completion callback, then goes to /order/<id>; the DEMO banner is visible', async () => {
    const user = userEvent.setup();
    server.put = (path) => {
      if (path === '/api/checkout/prepare') return json({ kind: 'demo', cardDue: 3015 });
      if (path === '/api/checkout/demo-authorize') return json({ status: 'authorized', orderId: 'ord-7' });
      if (path === '/api/checkout/complete') return json({ orderId: 'ord-7', orderNumber: 'MLV-000007' });
      return json({}, 404);
    };
    renderWithProviders(<CheckoutPage />);
    expect(await screen.findByText('DEMO payment (no PSP configured)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-7'));
    expect(calls.find((c) => c.path === '/api/checkout/prepare')?.body).toEqual({ expectedTotal: { centAmount: 3015, currencyCode: 'USD' } });
    expect(calls.find((c) => c.path === '/api/checkout/complete')?.body).toEqual({ orderId: 'ord-7' });
  });

  it('Declined payment: the message is inline in the payment card, the cart is kept and nothing is placed', async () => {
    const user = userEvent.setup();
    server.put = (path) => (path === '/api/checkout/prepare' ? json({ kind: 'demo', cardDue: 3015 }) : path === '/api/checkout/demo-authorize' ? json({ status: 'declined' }) : json({}, 404));
    renderWithProviders(<CheckoutPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Simulate a declined payment' }));
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    const card = document.querySelector('[data-checkout-card="payment"]') as HTMLElement;
    expect(await within(card).findByText(/Your payment was declined/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/checkout/complete')).toBe(false);
    expect(calls.find((c) => c.path === '/api/checkout/demo-authorize')?.body).toEqual({ decline: true });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('a load failure offers a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => (path === '/api/checkout' ? json({ error: 'x' }, 500) : json({ addresses: [] }))));
    renderWithProviders(<CheckoutPage />);
    expect(await screen.findByText('We could not load checkout. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
