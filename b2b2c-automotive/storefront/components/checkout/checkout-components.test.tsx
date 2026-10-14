// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { axe } from 'jest-axe';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const sdk = vi.hoisted(() => ({ checkoutFlow: vi.fn(), close: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { CheckoutError } from './CheckoutError';
import { CheckoutPage } from './CheckoutPage';
import { CheckoutWidget, returnPath } from './CheckoutWidget';
import { DevCompletePanel } from './DevCompletePanel';
import { PickupPanel } from './PickupPanel';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const fetchMock = vi.fn();
const ready = (id = 'sess-1') => new Response(JSON.stringify({ sessionId: id, projectKey: 'test-project', region: 'europe-west1.gcp' }), { status: 200 });
const refused = (status: number, error: string) => new Response(JSON.stringify({ error }), { status });
const flowConfig = () => sdk.checkoutFlow.mock.calls.at(-1)?.[0];
const widget = (props: Partial<Parameters<typeof CheckoutWidget>[0]> = {}, locale = 'en-US') =>
  renderWithProviders(<CheckoutWidget cartHref="/mau-reseller-north/cart" {...props} />, { locale, messages: locale === 'de-DE' ? deDE : enUS });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  sdk.checkoutFlow.mockReset();
  sdk.close.mockReset();
  fetchMock.mockImplementation(async () => ready());
});
afterEach(() => vi.unstubAllGlobals());

describe('CheckoutWidget', () => {
  it('mounts data-ctc exactly once under double render', async () => {
    renderWithProviders(
      <StrictMode>
        <CheckoutWidget cartHref="/mau-reseller-north/cart" />
      </StrictMode>,
      { messages: enUS },
    );
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(document.querySelectorAll('[data-ctc]')).toHaveLength(1);
    expect(sdk.checkoutFlow).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('passes locale project key region and session id to checkoutFlow', async () => {
    widget({}, 'de-DE');
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(flowConfig()).toMatchObject({ projectKey: 'test-project', region: 'europe-west1.gcp', sessionId: 'sess-1', locale: 'de', currencyLocale: 'de-DE', skipPaymentSuccessPage: true, tax: { display: true } });
    expect(flowConfig().styles).toBeDefined();
  });
  it('uses the English locale code of the Checkout for en-US', async () => {
    widget();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(flowConfig().locale).toBe('en-US');
  });
  it('shows a busy loading state before the session exists', async () => {
    let resolve: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolve = r)));
    widget();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your secure checkout');
    expect(screen.getByRole('region', { name: 'Contact, delivery and payment' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve(ready()));
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(screen.getByRole('region', { name: 'Contact, delivery and payment' })).toHaveAttribute('aria-busy', 'false');
  });
  it('retry creates a new session', async () => {
    fetchMock.mockImplementationOnce(async () => refused(502, 'checkout-unavailable')).mockImplementation(async () => ready('sess-2'));
    widget();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(flowConfig().sessionId).toBe('sess-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('error states render plain text', async () => {
    const cases: [number, string, string][] = [
      [409, 'cart-empty', 'Your cart is empty.'],
      [422, 'lines-unavailable', 'Some parts in your cart are no longer available.'],
      [422, 'subscriptions-unavailable', 'Subscriptions cannot be purchased right now.'],
      [503, 'checkout-not-configured', 'Checkout is not set up yet.'],
      [502, 'checkout-unavailable', 'We could not start the checkout.'],
    ];
    for (const [status, code, text] of cases) {
      fetchMock.mockImplementationOnce(async () => refused(status, code));
      const view = widget();
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.getByRole('link', { name: 'Back to cart' })).toHaveAttribute('href', '/en-US/mau-reseller-north/cart');
      expect(sdk.checkoutFlow).not.toHaveBeenCalled();
      view.unmount();
    }
  });
  it('only a temporary failure offers Try again', async () => {
    fetchMock.mockImplementationOnce(async () => refused(422, 'lines-unavailable'));
    widget();
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
  it('a network failure is the unavailable state', async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('network down');
    });
    widget();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not start the checkout.');
  });
  it('onError payload is rendered as text not html', async () => {
    widget();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    act(() => flowConfig().onError({ code: '<img src=x onerror=alert(1)>', payload: { message: '<b>boom</b>' } }));
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('img, b, script')).toBeNull();
    expect(alert).toHaveTextContent('Reference: imgsrcxonerroralert1');
    expect(alert).not.toHaveTextContent('boom');
  });
  it('checkout_completed goes to the return route with the order id', async () => {
    const navigate = vi.fn();
    widget({ navigate });
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    flowConfig().onInfo({ code: 'payment_started' });
    flowConfig().onInfo({ code: 'checkout_completed', payload: { order: { id: 'not-a-uuid' } } });
    expect(navigate).not.toHaveBeenCalled();
    flowConfig().onInfo({ code: 'checkout_completed', payload: { order: { id: ID } } });
    expect(navigate).toHaveBeenCalledWith(`/checkout/return?orderId=${ID}`);
  });
  it('closes the hosted flow when it unmounts', async () => {
    const view = widget();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    view.unmount();
    await waitFor(() => expect(sdk.close).toHaveBeenCalled());
  });
  it('returnPath accepts only a UUID', () => {
    expect(returnPath(ID)).toBe(`/checkout/return?orderId=${ID}`);
    expect(returnPath('../x')).toBeNull();
  });
});

describe('CheckoutError', () => {
  it('has no retry for a cart problem', () => {
    renderWithProviders(<CheckoutError reason="cart-empty" cartHref="/s/cart" onRetry={() => undefined} />, { messages: enUS });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PickupPanel', () => {
  const pickup = { branchName: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] as [string, string], sat: ['09:00', '13:00'] as [string, string] } };
  it('pickup panel shows address hours and ID reminder', () => {
    renderWithProviders(<PickupPanel pickup={pickup} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('heading', { name: 'Pickup at Malva Berlin' })).toBeInTheDocument();
    expect(screen.getByText(/Hauptstr\. 1, 10115 Berlin/)).toBeInTheDocument();
    expect(screen.getByText('8 AM – 6 PM')).toBeInTheDocument();
    expect(screen.getAllByText('Closed').length).toBe(5);
    expect(screen.getByText('Bring photo ID')).toBeInTheDocument();
  });
  it('hours follow the page language', () => {
    renderWithProviders(<PickupPanel pickup={pickup} />, { locale: 'de-DE', messages: deDE });
    expect(screen.getByText('08 Uhr – 18 Uhr')).toBeInTheDocument();
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Abholung in Malva Berlin')).toBeInTheDocument();
  });
});

describe('CheckoutPage', () => {
  const pickup = { branchName: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: {} };
  const page = (props: Partial<Parameters<typeof CheckoutPage>[0]> = {}, locale = 'en-US') =>
    renderWithProviders(<CheckoutPage store="mau-reseller-north" pickup={null} cancelled={false} devComplete={false} {...props} />, { locale, messages: locale === 'de-DE' ? deDE : enUS });
  it('ship preset shows no pickup panel', async () => {
    page();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(screen.queryByText('Bring photo ID')).toBeNull();
  });
  it('pickup preset shows the panel', async () => {
    page({ pickup });
    expect(screen.getByText('Bring photo ID')).toBeInTheDocument();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
  });
  it('a cancelled payment is explained and the cart stays reachable', async () => {
    page({ cancelled: true });
    expect(screen.getByText(/Your payment was not completed/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Back to cart' }).length).toBeGreaterThan(0);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
  });
  it('panel hidden by default', async () => {
    page();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(screen.queryByText('Developer completion (no payment)')).toBeNull();
  });
  it('dev panel renders only when the server enables it', async () => {
    page({ devComplete: true });
    expect(screen.getByRole('form', { name: 'Developer completion (no payment)' })).toBeInTheDocument();
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
  });
  it.each([
    ['en-US', enUS],
    ['de-DE', deDE],
  ])('axe clean in %s for the page chrome', async (locale) => {
    const { container } = page({ pickup, cancelled: true, devComplete: true }, locale);
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DevCompletePanel', () => {
  it('posts the email and follows the return URL', async () => {
    const navigate = vi.fn();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ redirect: `/checkout/return?orderId=${ID}` }), { status: 200 }));
    renderWithProviders(<DevCompletePanel navigate={navigate} />, { messages: enUS });
    await userEvent.click(screen.getByRole('button', { name: 'Create test order' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/checkout/return?orderId=${ID}`));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/dev/checkout/complete');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ customerEmail: 'qa-1@example.com' });
  });
  it('shows a failure and does not navigate to a foreign location', async () => {
    const navigate = vi.fn();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ redirect: 'https://evil.example/' }), { status: 200 }));
    renderWithProviders(<DevCompletePanel navigate={navigate} />, { messages: enUS });
    await userEvent.click(screen.getByRole('button', { name: 'Create test order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The test order could not be created.');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('no card data and no SDK outside the widget', () => {
  const dir = import.meta.dirname;
  const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  it('no card number or cvv input exists in components/checkout', () => {
    expect(sources.length).toBeGreaterThan(4);
    for (const file of sources) expect(readFileSync(path.join(dir, file), 'utf8'), file).not.toMatch(/card.?number|cvv|cvc|autoComplete=["']cc-/i);
  });
  it('the SDK is imported only by CheckoutWidget and only dynamically', () => {
    const root = path.resolve(dir, '..', '..');
    const files = ['components', 'hooks', 'lib', 'app'].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const importers = files.filter((f) => /checkout-browser-sdk/.test(readFileSync(f, 'utf8')));
    expect(importers.map((f) => path.basename(f))).toEqual(['CheckoutWidget.tsx']);
    expect(readFileSync(path.join(dir, 'CheckoutWidget.tsx'), 'utf8')).not.toMatch(/^import .* from '@commercetools\/checkout-browser-sdk'/m);
  });
  it('the storefront never creates a payment', () => {
    const root = path.resolve(dir, '..', '..');
    const files = ['lib', 'app'].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/payments\(\)\s*\.post|PAYMENT_PROVIDER|malva-offline/);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}
