import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usd, viewCart, viewLine } from '@/test/cart';
import { checkoutState } from '@/test/checkout';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/lib/checkout/hosted-sdk', async (orig) => ({ ...(await orig<typeof import('@/lib/checkout/hosted-sdk')>()), startHostedCheckout: vi.fn(async () => () => {}) }));

import CheckoutPage from '@/components/checkout/CheckoutPage';

afterEach(() => vi.unstubAllGlobals());

const sub = viewLine({ id: 's', fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } } });
const ship = viewLine({ id: 'd', fulfilment: 'delivery', unitPrice: usd(2000) });

function setup(lines: ReturnType<typeof viewLine>[], customer: Record<string, string> | null) {
  const state = checkoutState(viewCart(lines));
  stubFetch({
    '/api/checkout': () => state,
    '/api/auth/me': () => ({ customer }),
    '/api/cart': () => ({ cart: state.cart }),
    '/api/channels': () => ({ stores: [], selectedKey: null }),
  });
  renderShell(<CheckoutPage />);
}

describe('checkout identity for subscriptions', () => {
  it('identity step hides Continue as guest and explains why', async () => {
    setup([ship, sub], null);
    const note = await screen.findByTestId('subscription-needs-account');
    expect(note).toHaveTextContent('A subscription needs an account so you can manage it. Sign in or create one to continue.');
    expect(within(note).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account/sign-in?redirect=%2Fcheckout');
    expect(within(note).getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/account/register?redirect=%2Fcheckout');
    expect(screen.getByRole('button', { name: 'Continue to secure checkout' })).toBeDisabled();
  });

  it('a signed-in customer sees no account note', async () => {
    setup([ship, sub], { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'L' });
    expect(await screen.findByRole('button', { name: 'Continue to secure checkout' })).toBeEnabled();
    expect(screen.queryByTestId('subscription-needs-account')).toBeNull();
  });

  it('a guest bag without subscribe lines is unchanged', async () => {
    setup([ship], null);
    expect(await screen.findByRole('button', { name: 'Continue to secure checkout' })).toBeEnabled();
    expect(screen.queryByTestId('subscription-needs-account')).toBeNull();
  });
});
