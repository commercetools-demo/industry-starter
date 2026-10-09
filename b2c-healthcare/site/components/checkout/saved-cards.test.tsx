import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { PaymentCard, type PaymentCardProps } from './PaymentCard';

const sdk = vi.hoisted(() => ({ paymentFlow: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const props = (over: Partial<PaymentCardProps> = {}): PaymentCardProps => ({ mode: 'psp', ready: true, cartKey: 'c1:1875', onEvent: vi.fn(), simulateDecline: false, onSimulateDeclineChange: vi.fn(), ...over });

beforeEach(() => {
  sdk.paymentFlow.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => json({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp', paymentMode: 'psp' })));
});
afterEach(() => vi.unstubAllGlobals());

describe('payment-methods: saving a card while paying, paying with a saved one (T-10)', () => {
  it('the payment component is the only place a card is entered or chosen: the page explains it and links to the saved cards, and adds no card or "save" input of its own', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    const hint = document.querySelector('[data-saved-hint]') as HTMLElement;
    expect(hint).toHaveTextContent('Cards you saved before appear first. Tick "Save this card" in the payment form to use it next time.');
    expect(screen.getByRole('link', { name: 'Manage saved cards' })).toHaveAttribute('href', '/en-US/account/payment-methods');
    expect(document.querySelectorAll('[data-checkout-card="payment"] input')).toHaveLength(0);
  });

  it('the session is created for the cart only (the body carries nothing: no card, no method id); the customer comes from the cart the server holds', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.paymentFlow).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith('/api/checkout/session', { method: 'POST' });
  });

  it('the demo build has no saved-card text (there is no payment service to save to)', () => {
    renderWithProviders(<PaymentCard {...props({ mode: 'demo' })} />);
    expect(document.querySelector('[data-saved-hint]')).toBeNull();
  });
});
