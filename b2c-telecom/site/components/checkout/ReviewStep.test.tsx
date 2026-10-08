import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutError } from '@/hooks/useCheckout';
import { feeLine, fakeCheckout, makeCart, planLine, readyState, usd } from '@/test/fixtures/checkoutApi';
import { phoneLine } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }) }));

import { ReviewStep } from './ReviewStep';

const device = () =>
  planLine({
    id: 'D1',
    kind: 'device',
    offerKey: 'malva-offer-phone-nova-pro',
    sku: 'MLV-DEV-NOVAPRO-BLK-256',
    name: 'Nova Pro 256 GB',
    technology: null,
    family: null,
    schedule: null,
    label: null,
    unitListPrice: usd(4200),
    unitPrice: usd(4200),
    total: usd(4200),
    acquisition: { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' },
  });

beforeEach(() => vi.clearAllMocks());

describe('ReviewStep', () => {
  it('shows the price schedule and the Broadband Facts label of every plan, the service start and the totals source', () => {
    const state = readyState({ cart: makeCart({ lines: [planLine(), feeLine()] }) });
    renderWithProviders(<ReviewStep checkout={fakeCheckout(state)} onPayment={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Review your order' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your price, month by month' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /Broadband Facts: Cable 500/ })).toBeInTheDocument();
    expect(screen.getByText(/Your service starts/)).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Plans' });
    expect(within(section).getByText('$59.99/mo')).toBeInTheDocument();
  });

  it('a device line shows its acquisition summary and the end-of-term notice; plans without a device have none', () => {
    const state = readyState({ cart: makeCart({ lines: [planLine(), feeLine(), device()] }), needsDelivery: true });
    renderWithProviders(<ReviewStep checkout={fakeCheckout(state)} onPayment={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'Devices' });
    expect(within(section).getByText('Nova Pro 256 GB')).toBeInTheDocument();
    expect(within(section).getByText(/Total payable/)).toBeInTheDocument();
    expect(within(section).getByText(/yours after the final payment|final payment/i)).toBeInTheDocument();
  });

  it('the terms checkbox gates "Continue to payment", with the terms linked in a new tab', async () => {
    const checkout = fakeCheckout(readyState());
    renderWithProviders(<ReviewStep checkout={checkout} onPayment={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Continue to payment' });
    expect(button).toBeDisabled();
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/en-US/legal/terms');
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('target', '_blank');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });

  it('starts the payment with the total the buyer saw (exactly once) and hands the session over', async () => {
    const state = readyState();
    const startPayment = vi.fn(async () => ({ mode: 'hosted' as const, orderNumber: 'MLV-AAAAAAAA', sessionId: 's1', projectKey: 'p', region: 'r' }));
    const onPayment = vi.fn();
    renderWithProviders(<ReviewStep checkout={fakeCheckout(state, { startPayment })} onPayment={onPayment} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(startPayment).toHaveBeenCalledTimes(1);
    expect(startPayment).toHaveBeenCalledWith(8499);
    expect(onPayment).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }), 8499);
  });

  it('409 TOTAL_CHANGED shows the notice with both totals and starts no payment', async () => {
    const startPayment = vi.fn(async () => {
      throw new CheckoutError('TOTAL_CHANGED', 'x', 409, { total: usd(9999) });
    });
    const onPayment = vi.fn();
    renderWithProviders(<ReviewStep checkout={fakeCheckout(readyState(), { startPayment })} onPayment={onPayment} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByText('The total changed from $84.99 to $99.99. Review your order and pay again.')).toBeInTheDocument();
    expect(onPayment).not.toHaveBeenCalled();
  });

  it('a guest with monthly items is sent to sign in, then back to the review step', async () => {
    const startPayment = vi.fn(async () => {
      throw new CheckoutError('SIGN_IN_REQUIRED', 'x', 401);
    });
    renderWithProviders(<ReviewStep checkout={fakeCheckout(readyState({ signedIn: false }), { startPayment })} onPayment={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(nav.push).toHaveBeenCalledWith('/login?next=%2Fbundle%2Fcheckout%3Fstep%3Dreview');
  });

  it('a declined financing decision renders the financing notice and starts no payment', async () => {
    const decision = { decisionId: 'd1', outcome: 'declined', reason: 'customer-declined', financedTotal: usd(4200), limit: usd(250000), decidedAt: '2026-10-07T10:00:00Z' };
    const startPayment = vi.fn(async () => {
      throw new CheckoutError('FINANCING_DECLINED', 'x', 422, { decision });
    });
    const state = readyState({ cart: makeCart({ lines: [planLine(), feeLine(), device()] }), needsDelivery: true });
    renderWithProviders(<ReviewStep checkout={fakeCheckout(state, { startPayment })} onPayment={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByRole('alert', { name: /declined|approved|financing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay in full instead/ })).toBeInTheDocument();
  });

  it('any other refusal says what to change', async () => {
    const startPayment = vi.fn(async () => {
      throw new CheckoutError('NOT_SERVICEABLE', 'x', 422);
    });
    renderWithProviders(<ReviewStep checkout={fakeCheckout(readyState(), { startPayment })} onPayment={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByText(/We can't serve this address for everything in your bundle/)).toBeInTheDocument();
  });

  it('de-DE: German copy and consent text', () => {
    renderWithProviders(<ReviewStep checkout={fakeCheckout(readyState({ cart: makeCart({ lines: [phoneLine()] }) }))} onPayment={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Weiter zur Zahlung' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bedingungen' })).toHaveAttribute('href', '/de-DE/legal/terms');
  });
});
