import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unstable_serialize } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyChannels } from '@/lib/cache-keys';
import type { CheckoutPayment, CheckoutState } from '@/lib/types';
import { STORE_BK, STORE_SOHO, cad, usd, viewCart, viewLine } from '@/test/cart';
import { checkoutState } from '@/test/checkout';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const sdk = vi.hoisted(() => ({
  starts: [] as Array<{ sessionId: string; locale: string; currencyLocale: string; styles: Record<string, string>; onInfo: (c: string) => void; onError: (c: string) => void }>,
  closed: 0,
}));
vi.mock('@/lib/checkout/hosted-sdk', async (orig) => ({
  ...(await orig<typeof import('@/lib/checkout/hosted-sdk')>()),
  startHostedCheckout: vi.fn(async (c: (typeof sdk.starts)[number]) => {
    sdk.starts.push(c);
    return () => {
      sdk.closed += 1;
    };
  }),
}));

import CheckoutPage from '@/components/checkout/CheckoutPage';
import StorePicker from '@/components/store/StorePicker';

beforeEach(() => {
  sdk.starts = [];
  sdk.closed = 0;
  nav.replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const ship = (id: string, over = {}) => viewLine({ id, fulfilment: 'delivery', unitPrice: usd(2000), ...over });
const collect = (id: string, store = STORE_SOHO, over = {}) => viewLine({ id, fulfilment: 'collect', store, unitPrice: usd(1000), ...over });
const sub = (id: string) => viewLine({ id, fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } } });

const MEMBER = { id: 'cust-1', email: 'a@example.com', firstName: 'Maya', lastName: 'Lopez' };
const SESSION = { sessionId: 'sess-1', projectKey: 'spec-test-b2c-food', region: 'us-central1.gcp', orderNumber: 'MC-X', expiresAt: null };
type Routes = Parameters<typeof stubFetch>[0];

function setup(state: CheckoutState | { error: string; status: number }, { locale = 'en-US', routes = {}, customer = null as null | Record<string, string>, resumePart }: { locale?: string; routes?: Routes; customer?: null | Record<string, string>; resumePart?: number } = {}) {
  const us = locale === 'en-US';
  const channels = { stores: us ? [STORE_SOHO, STORE_BK] : [], selectedKey: null };
  const stub = stubFetch({
    '/api/checkout/pickup': () =>
      'error' in state
        ? state
        : { ...state, payments: state.payments ?? [{ part: 0, clusterKey: 'delivery', label: null, totalCents: state.summary.totalCents }] },
    '/api/checkout/session': () => SESSION,
    '/api/checkout/complete': () => ({ orderId: 'ord-1', next: null }),
    '/api/checkout': () =>
      'error' in state ? new Response(JSON.stringify({ error: { code: state.error, message: 'x' } }), { status: state.status }) : state,
    '/api/auth/me': () => ({ customer }),
    '/api/cart': () => ({ cart: 'cart' in state ? state.cart : null }),
    '/api/channels': () => channels,
    ...routes,
  });
  const result = renderShell(
    <>
      <CheckoutPage {...(resumePart === undefined ? {} : { resumePart })} />
      <StorePicker />
    </>,
    { locale, fallback: { [unstable_serialize(keyChannels(us ? 'US' : 'CA'))]: channels } },
  );
  return { stub, ...result };
}

const mixed = () => viewCart([collect('c'), ship('d'), sub('s')]);
const lineIn = (id: string) => document.querySelector(`[data-line-id="${id}"]`) as HTMLElement;
const clusterOf = (id: string) => lineIn(id).closest('[data-group]')?.getAttribute('data-group');
const ready = async () => screen.findByRole('button', { name: 'Continue to secure checkout' });
const calls = (stub: ReturnType<typeof stubFetch>, part: string) => stub.calls.filter((c) => c.url.startsWith(part));

describe('Review stage (K-10)', () => {
  it('Mixed bag shows one cluster per fulfilment group and each line inside its cluster', async () => {
    setup(checkoutState(mixed()));
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Pickup at Malva SoHo', 'Delivery', 'Subscription']);
    expect(clusterOf('c')).toBe('collect:mcf-store-nyc-soho');
    expect(clusterOf('d')).toBe('delivery');
    expect(clusterOf('s')).toBe('subscribe');
  });
  it('Each line shows the collect, delivery or subscription marker', async () => {
    setup(checkoutState(mixed()));
    await ready();
    expect(within(lineIn('c')).getByTestId('fulfilment-marker')).toHaveTextContent('Collect at Malva SoHo');
    expect(within(lineIn('d')).getByTestId('fulfilment-marker')).toHaveTextContent('Delivery');
    expect(within(lineIn('s')).getByTestId('fulfilment-marker')).toHaveTextContent('Every 2 weeks');
  });
  it('No line appears outside a cluster or in two clusters', async () => {
    setup(checkoutState(mixed()));
    await ready();
    const rows = Array.from(document.querySelectorAll('[data-line-id]'));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.closest('[data-group]')).not.toBeNull();
  });
  it('Collect only: no delivery cluster', async () => {
    setup(checkoutState(viewCart([collect('c')])));
    await ready();
    expect(document.querySelector('[data-group="delivery"]')).toBeNull();
    expect(screen.queryByTestId('delivery-note')).toBeNull();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
  it('Delivery only: no collect cluster', async () => {
    setup(checkoutState(viewCart([ship('d')])));
    await ready();
    expect(document.querySelector('[data-group^="collect:"]')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
  it('Canada bag shows no collect cluster and no store picker', async () => {
    setup(checkoutState(viewCart([ship('d', { unitPrice: cad(2000) })], { country: 'CA', currency: 'CAD' })), { locale: 'en-CA' });
    await ready();
    expect(document.querySelector('[data-group^="collect:"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByText(/Pickup/)).toBeNull();
  });
  it('Canada free delivery line says 99 CAD and US says 75 USD', async () => {
    const { unmount } = setup(checkoutState(viewCart([ship('d')])));
    await ready();
    expect(screen.getByTestId('delivery-note')).toHaveTextContent('Free delivery on orders over $75.00');
    unmount();
    setup(checkoutState(viewCart([ship('d', { unitPrice: cad(2000) })], { country: 'CA', currency: 'CAD' })), { locale: 'en-CA' });
    await ready();
    expect(screen.getByTestId('delivery-note').textContent).toContain('99.00');
    expect(screen.getByTestId('delivery-note').textContent).toContain('Free delivery on orders over');
  });
  it('Delivery days come from the data and are absent when the data has none', async () => {
    setup(checkoutState(viewCart([ship('d')]), { deliveryNote: { freeAboveCents: 7500, days: null } }));
    await ready();
    expect(screen.getByTestId('delivery-note')).not.toHaveTextContent('Delivery in');
  });
  it('Empty bag shows Nothing to check out', async () => {
    setup({ error: 'cart_empty', status: 409 });
    expect(await screen.findByRole('heading', { name: 'Nothing to check out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop coffee' })).toHaveAttribute('href', '/shop');
  });
  it('Subscription cluster shows the interval', async () => {
    setup(checkoutState(viewCart([sub('s')])));
    await ready();
    expect(within(clusterEl('subscribe')).getByText(/Every 2 weeks/)).toBeInTheDocument();
  });
  it('Later stage is not clickable', async () => {
    setup(checkoutState(viewCart([ship('d')])));
    await ready();
    expect(screen.getByText('Pay').closest('span[aria-disabled]')).not.toBeNull();
  });
  it('has no accessibility violations', async () => {
    const { container } = setup(checkoutState(mixed()));
    await ready();
    await expectNoAxeViolations(container);
  });
});
const clusterEl = (key: string) => document.querySelector(`[data-group="${key}"]`) as HTMLElement;

describe('Pickup card and issues (K-11)', () => {
  it('Someone else collects: the pickup name is required', async () => {
    const { stub } = setup(checkoutState(viewCart([collect('c')])));
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Someone else/ }));
    expect(screen.getByRole('radio', { name: /Someone else/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    expect(await screen.findByText('Enter the name of the person collecting.')).toBeInTheDocument();
    expect(calls(stub, '/api/checkout/pickup')).toHaveLength(0);
  });
  it('Missing pickup name focuses the field', async () => {
    const { stub } = setup(checkoutState(viewCart([collect('c')])));
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    const field = screen.getByLabelText('Pickup name');
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toBeTruthy();
    expect(calls(stub, '/api/checkout/session')).toHaveLength(0);
  });
  it('markup in the name gets its own message', async () => {
    setup(checkoutState(viewCart([collect('c')])));
    await ready();
    await userEvent.type(screen.getByLabelText('Pickup name'), '<b>Bob</b>');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to secure checkout' }));
    expect(await screen.findByText(/Use letters, spaces, apostrophes/)).toBeInTheDocument();
  });
  it('Pickup name is prefilled for a member', async () => {
    setup(checkoutState(viewCart([collect('c')])), { customer: { id: 'cust-1', email: 'a@example.com', firstName: 'Maya', lastName: 'Lopez' } });
    await ready();
    await waitFor(() => expect(screen.getByLabelText('Pickup name')).toHaveValue('Maya Lopez'));
    await userEvent.click(screen.getByRole('radio', { name: /Someone else/ }));
    expect(screen.getByLabelText('Pickup name')).toHaveValue('');
  });
  it('the pickup tiles are a radio group moved by the arrow keys', async () => {
    setup(checkoutState(viewCart([collect('c')])));
    await ready();
    const me = screen.getByRole('radio', { name: /It's me/ });
    expect(me).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: /Someone else/ })).toHaveAttribute('tabindex', '-1');
    me.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /Someone else/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Someone else/ })).toHaveFocus();
  });
  it('Ready minutes come from the store data', async () => {
    setup(checkoutState(viewCart([collect('c')])));
    await ready();
    expect(screen.getByText('Ready in about 15 minutes')).toBeInTheDocument();
    expect(screen.getByText(/Open today 08:00/)).toBeInTheDocument();
  });
  it('Collect out of stock blocks Continue', async () => {
    setup(checkoutState(viewCart([collect('c', STORE_SOHO, { notices: [{ kind: 'collect-unavailable' }] })])));
    await ready();
    expect(screen.getByRole('button', { name: 'Continue to secure checkout' })).toBeDisabled();
    expect(screen.getByTestId('checkout-issues')).toHaveTextContent('Product c is not in stock at Malva SoHo.');
    expect(within(screen.getByTestId('checkout-issues')).getByRole('link', { name: 'Back to bag' })).toHaveAttribute('href', '/cart');
  });
  it('Collect line in a Canada session shows collect_not_available', async () => {
    setup(checkoutState(viewCart([collect('c')], { country: 'CA', currency: 'CAD' })), { locale: 'en-CA' });
    await ready();
    expect(screen.getByTestId('checkout-issues')).toHaveTextContent('can only be collected in the US market');
    expect(screen.getByRole('button', { name: 'Continue to secure checkout' })).toBeDisabled();
  });
  it('a price change is a notice and does not block', async () => {
    setup(checkoutState(viewCart([ship('d', { notices: [{ kind: 'price-updated', previous: usd(1800) }] })])));
    await ready();
    expect(screen.getByTestId('checkout-issues')).toHaveTextContent('The price of Product d changed.');
    expect(screen.getByRole('button', { name: 'Continue to secure checkout' })).toBeEnabled();
  });
  it('Change store re-checks collect lines: the store picker opens from the Change button', async () => {
    setup(checkoutState(viewCart([collect('c')])));
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
const toPay = async (state: CheckoutState = checkoutState(viewCart([ship('d')])), opts: Parameters<typeof setup>[1] = {}) => {
  const out = setup(state, opts);
  await userEvent.click(await ready());
  await waitFor(() => expect(sdk.starts).toHaveLength(1));
  return out;
};

let sessions = 0;
describe('Pay stage: hosted Checkout (K-12)', () => {
  it('Widget mount point exists and the region is named', async () => {
    await toPay();
    const region = screen.getByRole('region', { name: 'Secure checkout' });
    expect(region.querySelector('[data-ctc]')).not.toBeNull();
    expect(screen.getByText(/Card details are entered in the secure payment form/)).toBeInTheDocument();
  });
  it('the session is created for the amount in the summary, for the first payment', async () => {
    const { stub } = await toPay(checkoutState(viewCart([ship('d')]), { payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 2911 }] }));
    const body = JSON.parse(String(calls(stub, '/api/checkout/session')[0]?.init?.body)) as { expectedTotalCents: number; part: number };
    expect(body).toEqual({ expectedTotalCents: 2911, part: 0 });
    expect(sdk.starts[0]?.sessionId).toBe('sess-1');
  });
  it('Locale is mapped for the SDK for en-US and en-CA', async () => {
    await toPay(checkoutState(viewCart([ship('d')]), { payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 2000 }] }));
    expect(sdk.starts[0]).toMatchObject({ locale: 'en', currencyLocale: 'en-US' });
  });
  it('Locale is mapped for the SDK for en-CA', async () => {
    const s = checkoutState(viewCart([ship('d', { unitPrice: cad(2000) })], { country: 'CA', currency: 'CAD' }), { payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 2000 }] });
    await toPay(s, { locale: 'en-CA' });
    expect(sdk.starts[0]).toMatchObject({ locale: 'en', currencyLocale: 'en-CA' });
  });
  it('Placement: the completed event calls complete and routes to the confirmation', async () => {
    const { stub } = await toPay(checkoutState(viewCart([ship('d')]), { payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 2000 }] }));
    sdk.starts[0]?.onInfo('checkout_completed');
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/checkout/confirmation/ord-1'));
    expect(calls(stub, '/api/checkout/complete')).toHaveLength(1);
    expect(JSON.parse(String(calls(stub, '/api/checkout/complete')[0]?.init?.body))).toEqual({ part: 0 });
  });
  it('other hosted events do nothing', async () => {
    const { stub } = await toPay();
    sdk.starts[0]?.onInfo('checkout_loaded');
    expect(calls(stub, '/api/checkout/complete')).toHaveLength(0);
  });
  it('Payment failure: our error region, the hosted flow stays, the bag is untouched', async () => {
    const { stub } = await toPay();
    sdk.starts[0]?.onError('payment_failed');
    expect(await screen.findByText(/Your payment was not accepted/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-banner', 'declined');
    expect(screen.getByRole('region', { name: 'Secure checkout' })).toBeInTheDocument();
    expect(calls(stub, '/api/checkout/complete')).toHaveLength(0);
    expect(sdk.closed).toBe(0);
    sdk.starts[0]?.onError('something_else');
    expect(await screen.findByText(/Something went wrong with the payment/)).toBeInTheDocument();
  });
  it('Hosted success and error pages are skipped: the SDK wrapper sets both options', async () => {
    const source = (await import('node:fs')).readFileSync('lib/checkout/hosted-sdk.ts', 'utf8');
    expect(source).toContain('skipPaymentSuccessPage: true');
    expect(source).toContain('skipPaymentErrorPage: true');
  });
  it('Theme reads tokens, no hex in code', async () => {
    const fs = await import('node:fs');
    const theme = fs.readFileSync('lib/checkout/theme.ts', 'utf8');
    expect(theme).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(theme).toContain('getComputedStyle');
    await toPay();
    expect(sdk.starts[0]?.styles).toBeDefined();
  });
  it('Totals moved before the session: a changed total goes back to Review and says so', async () => {
    const state = checkoutState(viewCart([ship('d')]));
    const { stub } = setup(state, {
      routes: { '/api/checkout/session': () => new Response(JSON.stringify({ error: { code: 'totals_changed', message: 'x', totalCents: 2500 } }), { status: 409 }) },
    });
    await userEvent.click(await ready());
    expect(await screen.findByText(/Your total changed/)).toBeInTheDocument();
    expect(sdk.starts).toHaveLength(0);
    expect(calls(stub, '/api/checkout').filter((c) => c.url === '/api/checkout').length).toBeGreaterThanOrEqual(2);
  });
  it('Placement outcome unknown shows one retry path', async () => {
    await toPay(checkoutState(viewCart([ship('d')]), { payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 2000 }] }), {
      routes: { '/api/checkout/complete': () => new Response(JSON.stringify({ error: { code: 'order_not_found', message: 'x' } }), { status: 404 }) },
    });
    sdk.starts[0]?.onInfo('checkout_completed');
    expect(await screen.findByText(/We could not confirm your order/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Review and try again' })).toHaveLength(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });
  it('an order that already exists goes to its confirmation, not to a second session', async () => {
    setup(checkoutState(viewCart([ship('d')])), {
      routes: { '/api/checkout/session': () => new Response(JSON.stringify({ error: { code: 'order_exists', message: 'x', orderId: 'ord-9' } }), { status: 409 }) },
    });
    await userEvent.click(await ready());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/checkout/confirmation/ord-9'));
    expect(sdk.starts).toHaveLength(0);
  });
  it('a sign-in rule shows the sign-in prompt', async () => {
    setup(checkoutState(viewCart([ship('d')])), {
      routes: { '/api/checkout/session': () => new Response(JSON.stringify({ error: { code: 'sign_in_required', message: 'x' } }), { status: 401 }) },
    });
    await userEvent.click(await ready());
    expect(await screen.findByText(/Sign in to check out with this bag/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account/sign-in?redirect=%2Fcheckout');
  });
  it('Back to review unmounts the widget and a new session is created on return', async () => {
    const { stub } = await toPay();
    await userEvent.click(screen.getByRole('button', { name: 'Back to review' }));
    expect(await ready()).toBeInTheDocument();
    expect(sdk.closed).toBe(1);
    await userEvent.click(await ready());
    await waitFor(() => expect(sdk.starts).toHaveLength(2));
    expect(calls(stub, '/api/checkout/session')).toHaveLength(2);
  });
  it('the done step button also goes back', async () => {
    await toPay();
    await userEvent.click(screen.getByRole('button', { name: /Review/ }));
    expect(await ready()).toBeInTheDocument();
  });
  it('the consent line links to the terms and the privacy policy in new tabs', async () => {
    await toPay();
    const terms = screen.getByRole('link', { name: 'terms' });
    expect(terms).toHaveAttribute('href', '/policies/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/policies/privacy');
  });
  it('Pay stage under complete-per-group names the payment n of total', async () => {
    const payments: CheckoutPayment[] = [
      { part: 0, clusterKey: 'collect:mcf-store-nyc-soho', label: 'Malva SoHo', totalCents: 1000 },
      { part: 1, clusterKey: 'delivery', label: null, totalCents: 2000 },
    ];
    await toPay(checkoutState(viewCart([collect('c'), ship('d')]), { payments }), { customer: MEMBER });
    expect(screen.getByTestId('payment-part')).toHaveTextContent('Payment 1 of 2: Pickup at Malva SoHo');
  });
  it('the second payment follows the first one; the bag is not told it is done until the last', async () => {
    const payments: CheckoutPayment[] = [
      { part: 0, clusterKey: 'collect:mcf-store-nyc-soho', label: 'Malva SoHo', totalCents: 1000 },
      { part: 1, clusterKey: 'delivery', label: null, totalCents: 2000 },
    ];
    const { stub } = await toPay(checkoutState(viewCart([collect('c'), ship('d')]), { payments }), {
      customer: MEMBER,
      routes: {
        '/api/checkout/complete': () => ({ orderId: 'ord-a', next: 1 }),
        '/api/checkout/session': () => ({ ...SESSION, sessionId: `sess-${++sessions}` }),
      },
    });
    sdk.starts[0]?.onInfo('checkout_completed');
    await waitFor(() => expect(sdk.starts).toHaveLength(2));
    expect(screen.getByTestId('payment-part')).toHaveTextContent('Payment 2 of 2: Delivery');
    expect(screen.getByText(/Your collection order is placed/)).toBeInTheDocument();
    expect(JSON.parse(String(calls(stub, '/api/checkout/session')[1]?.init?.body))).toEqual({ expectedTotalCents: 2000, part: 1 });
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe('resume after a redirect payment', () => {
  it('goes straight to the next payment', async () => {
    const payments: CheckoutPayment[] = [
      { part: 0, clusterKey: 'collect:mcf-store-nyc-soho', label: 'Malva SoHo', totalCents: 1000 },
      { part: 1, clusterKey: 'delivery', label: null, totalCents: 2000 },
    ];
    const { stub } = setup(checkoutState(viewCart([ship('d')]), { payments }), { resumePart: 1 });
    await waitFor(() => expect(sdk.starts).toHaveLength(1));
    expect(JSON.parse(String(calls(stub, '/api/checkout/session')[0]?.init?.body))).toEqual({ expectedTotalCents: 2000, part: 1 });
    expect(calls(stub, '/api/checkout?resume=1').length).toBeGreaterThan(0);
  });
});
