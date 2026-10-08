import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutState, TenderView } from '@/lib/types';
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

const tender = (over: Partial<TenderView> = {}): TenderView => ({
  allowance: null,
  restricted: { available: true, eligibleSubtotal: usd(1875), applies: usd(1875), chosen: false },
  card: usd(3135),
  needsOtherTender: usd(1260),
  ...over,
});

function state(t: TenderView, total = 3135): CheckoutState {
  return {
    cart: {
      id: 'cart-1', version: 3, itemCount: 2, lineCount: 2, currencyCode: 'USD',
      lines: [
        { id: 'l1', sku: 'A', name: { 'en-US': 'Atorvastatin 20 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-1', prescribedQty: 30, unitPrice: usd(1875), totalPrice: usd(1875), priceUpdated: false, eligibleForRestricted: true },
        { id: 'l2', sku: 'B', name: { 'en-US': 'Alprazolam 0.5 mg' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-2', prescribedQty: 30, unitPrice: usd(1260), totalPrice: usd(1260), priceUpdated: false },
      ],
      subtotal: usd(total), shipping: { name: 'Standard delivery', price: usd(0) }, total: usd(total), unavailableCount: 0,
      shippingAddress: ADDRESS, shippingMethodKey: 'mlv-standard', tax: usd(0), tender: t,
    },
    options: [{ key: 'mlv-standard', name: 'Standard delivery', price: usd(0) }],
    deliverable: true,
    paymentMode: 'demo',
  };
}

let current: CheckoutState;
let calls: { method: string; path: string; body?: unknown }[];
let onTender: (restricted: boolean) => Response;
beforeEach(() => {
  setPathname('/en-US/checkout');
  router.push.mockReset();
  calls = [];
  onTender = () => json({}, 404);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path, body });
      if (path === '/api/auth/me') return json({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
      if (path === '/api/account/addresses') return json({ addresses: [] });
      if (path === '/api/checkout' && method === 'GET') return json(current);
      if (path === '/api/checkout/tender') return onTender(body.restricted);
      if (path === '/api/checkout/demo-authorize') return json({ status: 'authorized' });
      if (path === '/api/checkout/place') return json({ orderId: 'ord-9', orderNumber: 'MLV-000009' });
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('eligible-item-tender-restriction: checkout offers the instrument only when available (U-10)', () => {
  it('Eligible subtotal shown, the amount needing another tender, and the instrument is offered', async () => {
    current = state(tender());
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    const summary = document.querySelector('[data-checkout-summary]') as HTMLElement;
    expect(within(summary).getByText('$18.75', { selector: '[data-eligible-subtotal]' })).toBeInTheDocument();
    expect(within(summary).getByText('$12.60', { selector: '[data-needs-other-tender]' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pay eligible items with the Health account card/ })).not.toBeChecked();
    expect(document.querySelector('[data-card-amount="due"]')).toHaveTextContent('$31.35');
  });

  it('Mixed basket splits: choosing the instrument sends the choice and the answer shows the card remainder', async () => {
    const user = userEvent.setup();
    current = state(tender());
    onTender = (restricted) => json(state(tender({ restricted: { available: true, eligibleSubtotal: usd(1875), applies: usd(1875), chosen: restricted }, card: usd(1260) })));
    renderWithProviders(<CheckoutPage />);
    await user.click(await screen.findByRole('checkbox', { name: /Pay eligible items with the Health account card/ }));
    await waitFor(() => expect(document.querySelector('[data-card-amount="due"]')).toHaveTextContent('$12.60'));
    expect(calls.find((c) => c.path === '/api/checkout/tender')).toMatchObject({ method: 'PUT', body: { restricted: true } });
    expect(screen.getByRole('checkbox', { name: /Pay eligible items/ })).toBeChecked();
  });

  it('Wholly ineligible basket: the instrument is not offered and the reason is stated', async () => {
    current = state(tender({ restricted: { available: false, reason: 'none-eligible', eligibleSubtotal: usd(0), applies: usd(0), chosen: false }, needsOtherTender: usd(3135) }));
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(screen.queryByRole('checkbox', { name: /Health account card/ })).toBeNull();
    const card = document.querySelector('[data-checkout-card="restricted"]') as HTMLElement;
    expect(card).toHaveAttribute('data-restricted', 'unavailable');
    expect(within(card).getByText(/none of these items are eligible/)).toBeInTheDocument();
  });

  it('Wholly eligible basket: the instrument settles everything, no card payment is shown or asked for, and Place order places directly', async () => {
    const user = userEvent.setup();
    current = state(tender({ restricted: { available: true, eligibleSubtotal: usd(3135), applies: usd(3135), chosen: true }, card: usd(0), needsOtherTender: usd(0) }));
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(document.querySelector('[data-no-card]')).not.toBeNull();
    expect(document.querySelector('[data-card-amount="none"]')).toHaveTextContent('No card payment needed');
    expect(document.querySelector('[data-demo-banner]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/order/ord-9'));
    expect(calls.some((c) => c.path === '/api/checkout/demo-authorize')).toBe(false);
    expect(calls.find((c) => c.path === '/api/checkout/place')).toBeDefined();
  });

  it('Balance visible before committing: the allowance balance, what this order would use and the forfeit date', async () => {
    current = state(tender({ allowance: { balance: usd(3000), applies: usd(3000), forfeitsOn: '2026-11-01' }, card: usd(135) }));
    renderWithProviders(<CheckoutPage />);
    await screen.findByText('Order summary');
    expect(document.querySelector('[data-allowance-balance]')).toHaveTextContent('$30.00');
    expect(document.querySelector('[data-allowance-applies]')).toHaveTextContent('$30.00');
    expect(screen.getByText(/forfeited on/i)).toBeInTheDocument();
  });
});
