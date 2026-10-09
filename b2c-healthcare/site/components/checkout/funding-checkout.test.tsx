import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutState } from '@/lib/types';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, within } from '@/test/utils';
import { CheckoutPage } from './CheckoutPage';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));
vi.mock('@commercetools/checkout-browser-sdk', () => ({ paymentFlow: vi.fn() }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const ADDRESS = { firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'New York', state: 'NY', zip: '10001', phone: '+15125550100' };

function state(over: Partial<CheckoutState['cart']> = {}): CheckoutState {
  return {
    cart: {
      id: 'cart-1', version: 3, itemCount: 2, lineCount: 2, currencyCode: 'USD',
      lines: [
        { id: 'l1', sku: 'A', name: { 'en-US': 'Atorvastatin 20 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-1', prescribedQty: 30, unitPrice: usd(375), totalPrice: usd(375), priceUpdated: false, cover: 'partly', coveredAmount: usd(1500), youOwe: usd(375) },
        { id: 'l2', sku: 'B', name: { 'en-US': 'Ibuprofen 400 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-2', prescribedQty: 20, unitPrice: usd(620), totalPrice: usd(620), priceUpdated: false, cover: 'not-covered', coveredAmount: usd(0), youOwe: usd(620) },
      ],
      subtotal: usd(995), shipping: { name: 'Standard delivery', price: usd(0) }, total: usd(995), unavailableCount: 0,
      youOwe: usd(995), planCovers: usd(1500),
      shippingAddress: ADDRESS, shippingMethodKey: 'mlv-standard', tax: usd(0),
      ...over,
    },
    options: [{ key: 'mlv-standard', name: 'Standard delivery', price: usd(0) }],
    deliverable: true,
    paymentMode: 'demo',
  };
}

let current: CheckoutState;
beforeEach(() => {
  setPathname('/en-US/checkout');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/auth/me') return json({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
      if (path === '/api/account/addresses') return json({ addresses: [] });
      if (path === '/api/checkout') return json(current);
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('payer-and-patient-cost-share: checkout UI (U-04)', () => {
  it('Covered line shows both figures in the summary, with two totals', async () => {
    current = state();
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    const summary = document.querySelector('[data-checkout-summary]') as HTMLElement;
    expect(within(summary).getByText('Plan covers $15.00')).toBeInTheDocument();
    expect(within(summary).getByText('Not covered')).toBeInTheDocument();
    expect(within(summary).getByText('$15.00', { selector: '[data-plan-covers] b' })).toBeInTheDocument();
    expect(within(summary).getByText('You owe')).toBeInTheDocument();
    expect(document.querySelector('[data-total]')).toHaveTextContent('$9.95');
    expect(within(summary).getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('Resolver unavailable: no totals, "Cover unresolved", Place order disabled with the reason', async () => {
    current = state({
      unresolved: true,
      lines: state().cart.lines.map((l) => ({ ...l, cover: 'unresolved' as const })),
    });
    delete current.cart.youOwe;
    delete current.cart.planCovers;
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    const summary = document.querySelector('[data-checkout-summary]') as HTMLElement;
    expect(within(summary).getAllByText('Cover unresolved')).toHaveLength(2);
    expect(within(summary).queryByText('Not covered')).toBeNull();
    expect(document.querySelector('[data-total]')).toBeNull();
    expect(within(summary).getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(summary.querySelector('[data-place-blocked]')).toHaveTextContent(/could not confirm what your plan covers/i);
  });
});
