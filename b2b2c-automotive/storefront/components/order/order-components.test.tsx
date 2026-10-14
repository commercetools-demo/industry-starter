// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import type { OrderView } from '@/lib/types';
import { renderWithProviders } from '@/test/render';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}));

import { OrderConfirmation } from './OrderConfirmation';

const money = (centAmount: number, currencyCode = 'EUR') => ({ centAmount, currencyCode, fractionDigits: 2 });
const STORE = 'mau-reseller-north';
const PRIVATE_PATH = `/en-US/${STORE}/checkout/confirmation/MA-7K3M9Q2X?t=tok.en.sig`;

const base: OrderView = {
  id: 'o-1',
  number: 'MA-7K3M9Q2X',
  storeKey: STORE,
  status: 'placed',
  mode: 'pickup',
  payment: 'paid',
  shippingMethodKey: 'mau-ship-pickup',
  email: 'qa-p1@example.com',
  hasCustomer: false,
  lines: [
    { id: 'l1', brand: 'Brembo', name: 'Front brake disc', imageUrl: 'https://img.example.test/a.jpg', quantity: 2, total: money(10000), recurrence: null },
    { id: 'l2', brand: null, name: 'Oil filter', imageUrl: null, quantity: 1, total: money(1500), recurrence: { policyName: 'Every 3 months' } },
  ],
  totals: {
    subtotal: money(12000),
    savings: [{ discountId: 'd1', name: 'Spring sale', amount: money(500) }],
    delivery: money(0),
    tax: { label: 'Sales tax (19%)', rate: 0.19, amount: money(1840) },
    total: money(11500),
    pricesIncludeTax: true,
  },
  pickup: { branchName: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'], sat: ['09:00', '13:00'] }, timezone: 'Europe/Berlin' },
  shipTo: null,
  shipWindow: { min: 2, max: 3 },
  storeName: 'Malva North',
  subscription: { frequencies: ['Every 3 months'], state: 'scheduled', nextOrderAt: '2026-12-15T08:00:00.000Z' },
  timezone: 'Europe/Berlin',
};
const ship: OrderView = {
  ...base,
  mode: 'ship',
  shippingMethodKey: 'mau-ship-standard',
  pickup: null,
  shipTo: { name: 'Ada Test', street: 'Lindenallee 4', postalCode: '20095', city: 'Hamburg', country: 'DE' },
  totals: { ...base.totals, delivery: money(490) },
};

const show = (view: OrderView, props: Partial<Parameters<typeof OrderConfirmation>[0]> = {}, locale = 'en-US') =>
  renderWithProviders(<OrderConfirmation view={view} store={STORE} viewer="guest" privatePath={PRIVATE_PATH} token="tok.en.sig" {...props} />, { locale, messages: locale === 'de-DE' ? deDE : enUS });

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('OrderConfirmation', () => {
  it('heading and order number render from props', () => {
    show({ ...base, number: 'MA-ZZZZ0001' });
    expect(screen.getByRole('heading', { level: 1, name: 'Thanks, your order is in.' })).toBeInTheDocument();
    expect(screen.getByText('Order MA-ZZZZ0001')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Order placed' })).toBeInTheDocument();
  });
  it('the heading takes the focus on load', () => {
    show(base);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });
  it('pickup copy', () => {
    show(base);
    expect(screen.getByText('Ready when you are: collect it at Malva Berlin in Berlin. Bring photo ID.')).toBeInTheDocument();
  });
  it('shipping copy', () => {
    show(ship);
    expect(screen.getByText('Shipping from Malva North, arriving in 2-3 business days.')).toBeInTheDocument();
  });
  it('payment state wording follows the order', () => {
    show(base);
    expect(screen.getByText('Payment received')).toBeInTheDocument();
  });
  it('a pending payment is explained and a failed one points to the store', () => {
    const { unmount } = show({ ...base, payment: 'pending' });
    expect(screen.getByText(/being confirmed/)).toBeInTheDocument();
    unmount();
    show({ ...base, payment: 'failed' });
    expect(screen.getByText('The payment did not go through. Contact Malva North to finish your order.')).toBeInTheDocument();
  });
  it('no email note is shown', () => {
    show(base);
    expect(screen.getByText("We don't send emails. Keep this page's link or create an account to find your order later.")).toBeInTheDocument();
  });
  it('the signed-in owner is told the order is in the account', () => {
    show(base, { viewer: 'owner', privatePath: null });
    expect(screen.getByText(/in your account/)).toBeInTheDocument();
  });
  it('no email or text promise anywhere on the page', () => {
    for (const [locale, messages] of [['en-US', enUS], ['de-DE', deDE]] as const) {
      for (const view of [base, ship, { ...base, status: 'ready-for-pickup' as const }, { ...ship, status: 'shipped' as const }]) {
        const { container, unmount } = renderWithProviders(<OrderConfirmation view={view} store={STORE} viewer="guest" privatePath={PRIVATE_PATH} token="t" />, { locale, messages });
        const text = (container.textContent ?? '').replace(/We don't send emails[^.]*\./, '').replace(/Wir versenden keine E-Mails[^.]*\./, '');
        expect(text).not.toMatch(/we.ll (e-?mail|text)|email you|text you|texted|sms|wir senden Ihnen|per E-Mail|per SMS/i);
        unmount();
      }
    }
    const raw = JSON.stringify({ en: enUS.order, de: deDE.order });
    expect(raw).not.toMatch(/email you|text you|we.ll email|we.ll text|texted|sms/i);
  });
  it('summary shows named savings and tax label', () => {
    show(base);
    const summary = screen.getByRole('region', { name: 'Order summary' });
    expect(within(summary).getByText('Spring sale')).toBeInTheDocument();
    expect(within(summary).getByText('−€5.00'.replace('€', '€'), { exact: false })).toBeInTheDocument();
    expect(within(summary).getByText('Sales tax (19%)')).toBeInTheDocument();
    expect(within(summary).getByText('€18.40')).toBeInTheDocument();
    expect(within(summary).getByText('Total').nextSibling).toHaveTextContent('€115.00');
    expect(within(summary).getByText('Front brake disc')).toBeInTheDocument();
    expect(within(summary).getByText('Brembo')).toBeInTheDocument();
    expect(within(summary).getByText('Free')).toBeInTheDocument();
  });
  it('a missing tax label falls back to the generic label or the rate', () => {
    const { unmount } = show({ ...base, totals: { ...base.totals, tax: { label: '', rate: null, amount: money(100) } } });
    expect(screen.getByText('Tax')).toBeInTheDocument();
    unmount();
    show({ ...base, totals: { ...base.totals, tax: { label: '', rate: 0.07, amount: money(100) } } });
    expect(screen.getByText('Tax (7%)')).toBeInTheDocument();
  });
  it('the currency of the order is used, not a constant', () => {
    show({ ...base, totals: { ...base.totals, total: money(9900, 'USD'), savings: [], delivery: money(0, 'USD'), subtotal: money(9900, 'USD'), tax: null } });
    expect(screen.getByText('Total').nextSibling).toHaveTextContent('$99.00');
  });
  it('subscription chip and block render', () => {
    show(base);
    expect(screen.getByText('Delivery: Every 3 months', { selector: 'span' })).toBeInTheDocument();
    const block = screen.getByRole('region', { name: 'Your subscription' });
    expect(within(block).getByText('Next delivery: December 15, 2026')).toBeInTheDocument();
  });
  it('a subscription without a recurring order says it is being set up and shows no date', () => {
    show({ ...base, subscription: { frequencies: ['Every 3 months'], state: 'setting-up', nextOrderAt: null } });
    const block = screen.getByRole('region', { name: 'Your subscription' });
    expect(within(block).getByText('Your subscription is being set up.')).toBeInTheDocument();
    expect(within(block).queryByText(/Next delivery/)).toBeNull();
  });
  it('a one-time order has no subscription block', () => {
    show({ ...base, lines: [base.lines[0]], subscription: null });
    expect(screen.queryByRole('region', { name: 'Your subscription' })).toBeNull();
  });
  it('the manage link is for the signed-in owner only', () => {
    const { unmount } = show(base, { viewer: 'owner', privatePath: null });
    expect(screen.getByRole('link', { name: 'Manage subscriptions' })).toHaveAttribute('href', `/en-US/${STORE}/account/subscriptions`);
    unmount();
    show(base);
    expect(screen.queryByRole('link', { name: 'Manage subscriptions' })).toBeNull();
  });
  it('pickup details show hours and ID reminder', () => {
    show(base);
    const details = screen.getByRole('region', { name: 'Pick up at Malva Berlin' });
    expect(within(details).getByText(/Hauptstr\. 1, 10115 Berlin/)).toBeInTheDocument();
    const hours = within(details).getByText('Mon');
    expect(hours.nextSibling).toHaveTextContent('8 AM – 6 PM');
    expect(within(details).getAllByText('Closed').length).toBeGreaterThan(0);
    expect(within(details).getByText('Bring photo ID')).toBeInTheDocument();
  });
  it('shipping details show address', () => {
    show(ship);
    const details = screen.getByRole('region', { name: 'Delivery address' });
    expect(within(details).getByText('Ada Test')).toBeInTheDocument();
    expect(within(details).getByText('Lindenallee 4')).toBeInTheDocument();
    expect(within(details).getByText('20095 Hamburg')).toBeInTheDocument();
    expect(within(details).getByText('Germany')).toBeInTheDocument();
    expect(screen.queryByText(/photo ID/)).toBeNull();
  });
  it('timeline marks current step', () => {
    const { container } = show(base);
    const list = container.querySelector('ol') as HTMLElement;
    expect(list).not.toBeNull();
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('aria-current'))).toEqual(['step', null, null]);
    expect(items[0]).toHaveTextContent('Order received');
    expect(items[1]).toHaveTextContent('Ready for pickup');
  });
  it('ship timeline names shipped and delivered', () => {
    show({ ...ship, status: 'shipped' });
    const items = screen.getAllByRole('listitem').filter((i) => i.hasAttribute('data-state'));
    expect(items.map((i) => i.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(items[2]).toHaveTextContent('Delivered');
  });
  it('guest sees create account and copy link', () => {
    show(base);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('qa-p1@example.com');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.queryByRole('link', { name: 'View order' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', `/en-US/${STORE}`);
  });
  it('signed in sees view order and no copy link', () => {
    show({ ...base, hasCustomer: true }, { viewer: 'owner', privatePath: null });
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', `/en-US/${STORE}/account/orders/MA-7K3M9Q2X`);
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
  });
  it('a link holder of an order with an account sees only continue shopping', () => {
    show({ ...base, hasCustomer: true }, { viewer: 'holder', privatePath: null });
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View order' })).toBeNull();
  });
  it('copy button copies the private link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    show(base);
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${PRIVATE_PATH}`);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });
  it('copy falls back to selecting the field when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    show(base);
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Select the link and copy it.')).toBeInTheDocument();
  });
  it('the field shows the full address of the private link', async () => {
    show(base);
    await waitFor(() => expect(screen.getByLabelText('Private link to this order')).toHaveValue(`${window.location.origin}${PRIVATE_PATH}`));
  });
  it('print is offered and the follow-up actions are hidden in print', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    show(base);
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Continue shopping' }).closest('.print\\:hidden')).not.toBeNull();
  });
  it('de-DE strings and euro formatting', () => {
    show(base, {}, 'de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Danke, Ihre Bestellung ist eingegangen.' })).toBeInTheDocument();
    expect(screen.getByText('Gesamt').nextSibling).toHaveTextContent('115,00');
    expect(screen.getByRole('button', { name: 'Konto anlegen' })).toBeInTheDocument();
    expect(screen.getByText('Bitte Lichtbildausweis mitbringen')).toBeInTheDocument();
  });
  it('axe clean in de-DE and en-US', async () => {
    for (const locale of ['en-US', 'de-DE']) {
      for (const view of [base, ship]) {
        const { container, unmount } = show(view, {}, locale);
        expect(await axe(container)).toHaveNoViolations();
        unmount();
      }
    }
  });
});

describe('GuestAccountForm', () => {
  const fill = async (password: string) => {
    await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  };
  it('posts only the password, the store and the token, then refreshes the page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    show(base);
    await fill('correct horse battery');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/orders/MA-7K3M9Q2X/claim');
    expect(JSON.parse(init.body)).toEqual({ store: STORE, password: 'correct horse battery', token: 'tok.en.sig' });
  });
  it('the weak password message names the rule', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'password', rule: 'too-short' }), { status: 400 }));
    show(base);
    await fill('short');
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 10 characters.');
    expect(refresh).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'password', rule: 'too-common' }), { status: 400 }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('too common'));
  });
  it('a refused account shows one generic message and takes the focus', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'account-failed' }), { status: 409 }));
    show(base);
    await fill('correct horse battery');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not create the account. Try signing in.');
    await waitFor(() => expect(alert).toHaveFocus());
  });
  it('rate limiting and an outage are told apart from a refusal', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    show(base);
    await fill('correct horse battery');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => userEvent.click(screen.getByRole('button', { name: 'Create account' })));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not create the account'));
  });
  it('the submit button waits for a password', () => {
    show(base);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });
});
