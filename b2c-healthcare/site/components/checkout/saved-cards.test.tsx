import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { PaymentCard, type PaymentCardProps } from './PaymentCard';

const sdk = vi.hoisted(() => ({ checkoutFlow: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);

const props = (over: Partial<PaymentCardProps> = {}): PaymentCardProps => ({
  mode: 'psp', ready: true, session: { sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' }, onEvent: vi.fn(), simulateDecline: false, onSimulateDeclineChange: vi.fn(), ...over,
});

beforeEach(() => sdk.checkoutFlow.mockReset());

describe('payment-methods: saving a card while paying, paying with a saved one', () => {
  it('the Checkout flow is the only place a card is entered or chosen: the page explains it and links to the saved cards, and adds no card or "save" input of its own', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    const hint = document.querySelector('[data-saved-hint]') as HTMLElement;
    expect(hint).toHaveTextContent('Cards you saved before appear first. Tick "Save this card" in the payment form to use it next time.');
    expect(screen.getByRole('link', { name: 'Manage saved cards' })).toHaveAttribute('href', '/en-US/account/payment-methods');
    expect(document.querySelectorAll('[data-checkout-card="payment"] input')).toHaveLength(0);
  });

  it('the SDK gets the session only (no card, no method id): the customer comes from the cart the server prepared', async () => {
    renderWithProviders(<PaymentCard {...props()} />);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(Object.keys(sdk.checkoutFlow.mock.calls[0][0] as object).sort()).toEqual(['locale', 'onError', 'onInfo', 'projectKey', 'region', 'sessionId']);
  });

  it('the demo build has no saved-card text (there is no payment service to save to)', () => {
    renderWithProviders(<PaymentCard {...props({ mode: 'demo', session: null })} />);
    expect(document.querySelector('[data-saved-hint]')).toBeNull();
  });
});
