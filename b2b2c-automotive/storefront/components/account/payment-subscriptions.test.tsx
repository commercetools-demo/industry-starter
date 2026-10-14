// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionView } from '@/lib/types';

vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock());

import { PaymentMethodsPanel } from './PaymentMethodsPanel';
import { SubscriptionList } from './SubscriptionList';
import { renderAccount, stubFetch } from './test-support';

beforeEach(() => vi.unstubAllGlobals());

describe('PaymentMethodsPanel', () => {
  const method = { id: 'pm1', label: 'Visa', last4: '4242', expiry: '04/29', isDefault: true };
  it('empty state has no add button', async () => {
    stubFetch({ 'GET /api/account/payment-methods': { methods: [], hasSubscriptions: false } });
    renderAccount(<PaymentMethodsPanel />);
    expect(await screen.findByText('No saved payment methods. Methods saved during checkout, for example for a subscription, appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });
  it('lists tokenised data only and deletes after asking', async () => {
    const calls = stubFetch({ 'GET /api/account/payment-methods': { methods: [method], hasSubscriptions: false }, 'DELETE /api/account/payment-methods/pm1': { ok: true } });
    const { container } = renderAccount(<PaymentMethodsPanel />);
    expect(await screen.findByText('ending 4242')).toBeInTheDocument();
    expect(screen.getByText('expires 04/29')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Delete payment method Visa' }));
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/account/payment-methods/pm1')).toBe(true));
    expect(await screen.findByText(/No saved payment methods/)).toBeInTheDocument();
  });
  it('warns about subscriptions before a delete', async () => {
    stubFetch({ 'GET /api/account/payment-methods': { methods: [method], hasSubscriptions: true } });
    renderAccount(<PaymentMethodsPanel />);
    expect(await screen.findByText(/You have subscriptions\. If you delete the method/)).toBeInTheDocument();
  });
  it('error state', async () => {
    stubFetch({ 'GET /api/account/payment-methods': new Response('{}', { status: 500 }) });
    renderAccount(<PaymentMethodsPanel />);
    expect(await screen.findByText('We could not load this page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('SubscriptionList', () => {
  const sub = (over: Partial<SubscriptionView> = {}): SubscriptionView => ({
    id: 'ro1',
    status: 'active',
    frequency: 'Every 3 months',
    policyKey: 'mau-rp-quarterly',
    nextOrderAt: '2026-11-01T00:00:00Z',
    skipPending: 0,
    orderNumber: 'MA-ABCD2345',
    lines: [{ name: 'Oil filter', quantity: 2, imageUrl: null }],
    ...over,
  });
  const policies = [
    { key: 'mau-rp-monthly', label: 'Every month' },
    { key: 'mau-rp-quarterly', label: 'Every 3 months' },
  ];
  const list = (subs: SubscriptionView[]) => ({ offered: true, subscriptions: subs, policies });
  const url = 'GET /api/account/subscriptions';

  it('SubscriptionList shows status frequency and next renewal', async () => {
    stubFetch({ [url]: list([sub()]) });
    const { container } = renderAccount(<SubscriptionList store="mau-reseller-north" timeZone="UTC" />);
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Every 3 months')).toBeInTheDocument();
    expect(screen.getByText(/Nov 1, 2026|1 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText('2 × Oil filter')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('skip and pause need no confirm, change frequency and cancel do', async () => {
    const calls = stubFetch({
      [url]: list([sub()]),
      'PUT /api/account/subscriptions/ro1': (body: unknown) => ({ subscription: sub({ status: (body as { action: string }).action === 'pause' ? 'paused' : 'active', skipPending: (body as { action: string }).action === 'skip' ? 1 : 0, nextOrderAt: '2027-02-01T00:00:00Z' }) }),
    });
    renderAccount(<SubscriptionList store="mau-reseller-north" timeZone="UTC" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip next delivery' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/account/subscriptions/ro1')).toBe(true));
    expect(calls.at(-1)?.body).toEqual({ action: 'skip' });
    // skip moves displayed next date to the value returned by the API
    expect(await screen.findByText(/Feb 1, 2027|1 Feb 2027/)).toBeInTheDocument();
    expect(screen.getByText('The next delivery is skipped.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ action: 'pause' }));
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

    // cancel asks first
    const before = calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(calls).toHaveLength(before);
    expect(screen.getByText('Cancel this subscription? It cannot be restarted.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ action: 'cancel' }));
  });

  it('change frequency asks to confirm and sends the policy key', async () => {
    const calls = stubFetch({ [url]: list([sub()]), 'PUT /api/account/subscriptions/ro1': { subscription: sub({ frequency: 'Every month', policyKey: 'mau-rp-monthly' }) } });
    renderAccount(<SubscriptionList store="mau-reseller-north" timeZone="UTC" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Change frequency' }));
    await userEvent.selectOptions(screen.getByLabelText('New frequency'), 'mau-rp-monthly');
    await userEvent.click(screen.getByRole('button', { name: 'Apply new frequency' }));
    expect(screen.getByText('Change the frequency to Every month?')).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ key: 'PUT /api/account/subscriptions/ro1', body: { action: 'change-frequency', policyKey: 'mau-rp-monthly' } }));
    expect(await screen.findByText('Every month')).toBeInTheDocument();
  });

  it('failed order shows the payment message and a resume action', async () => {
    const calls = stubFetch({ [url]: list([sub({ status: 'failed' })]), 'PUT /api/account/subscriptions/ro1': { subscription: sub() } });
    renderAccount(<SubscriptionList store="mau-reseller-north" timeZone="UTC" />);
    expect(await screen.findByText('Payment failed. Update your payment method, then resume.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to payment methods' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/payment-methods');
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ action: 'resume' }));
  });

  it('a cancelled subscription has no actions', async () => {
    stubFetch({ [url]: list([sub({ status: 'canceled' })]) });
    renderAccount(<SubscriptionList store="s" />);
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('empty state invites to subscribe on eligible parts', async () => {
    stubFetch({ [url]: list([]) });
    renderAccount(<SubscriptionList store="mau-reseller-north" timeZone="UTC" />);
    expect(await screen.findByText('You have no subscriptions yet. Look for Subscribe and save on eligible parts.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse parts' })).toBeInTheDocument();
  });

  it('a refusal of the server is shown in words', async () => {
    stubFetch({ [url]: list([sub()]), 'PUT /api/account/subscriptions/ro1': new Response(JSON.stringify({ error: 'busy' }), { status: 409 }) });
    renderAccount(<SubscriptionList store="s" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('The subscription is being processed. Try again in a minute.')).toBeInTheDocument();
  });

  it('change frequency is hidden when the store offers no policies', async () => {
    stubFetch({ [url]: { offered: true, subscriptions: [sub()], policies: [] } });
    renderAccount(<SubscriptionList store="s" />);
    await screen.findByText('Every 3 months');
    expect(screen.queryByRole('button', { name: 'Change frequency' })).not.toBeInTheDocument();
  });

  it('de-DE labels', async () => {
    stubFetch({ [url]: list([sub()]) });
    renderAccount(<SubscriptionList store="s" />, 'de-DE');
    expect(await screen.findByRole('button', { name: 'Nächste Lieferung überspringen' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Ihre Abos' })).getByText('Aktiv')).toBeInTheDocument();
  });
});
