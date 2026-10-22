import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { POLICY_1M, POLICY_2W, RO_ID, subscription } from '@/test/recurring';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import SubscriptionsTab from '@/components/account/subscriptions/SubscriptionsTab';
import type { PendingSubscription, Subscription } from '@/lib/types';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const policies = {
  policies: [
    { id: POLICY_2W, key: 'mcf-every-2-weeks', name: 'Every 2 weeks', schedule: { unit: 'Weeks', value: 2 } },
    { id: POLICY_1M, key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } },
  ],
};

interface Setup { list?: Subscription[]; pending?: PendingSubscription[]; put?: (body: { action: string; recurrencePolicyId?: string }) => Subscription | Response }

function setup({ list = [subscription()], pending = [], put }: Setup = {}) {
  let current = list;
  const stub = stubFetch({
    '/api/auth/me': () => ({ customer }),
    '/api/recurrence-policies': () => policies,
    // The PUT route first: the list route is a prefix of it.
    [`/api/recurring-orders/${RO_ID}`]: (init) => {
      const out = put?.(JSON.parse(String(init?.body))) ?? subscription();
      if (out instanceof Response) return out;
      current = current.map((s) => (s.id === out.id ? out : s));
      return { subscription: out };
    },
    '/api/recurring-orders': () => ({ subscriptions: current, pending }),
  });
  const view = renderShell(<SubscriptionsTab />);
  return { ...view, ...stub };
}

const puts = (calls: { url: string; init?: RequestInit }[]) => calls.filter((c) => c.init?.method === 'PUT');

beforeEach(() => {
  nav.pathname = '/account/subscriptions';
});
afterEach(() => vi.unstubAllGlobals());

describe('Subscriptions tab', () => {
  it('Recurring order created: card shows interval and next delivery date', async () => {
    setup();
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).getByTestId('subscription-interval')).toHaveTextContent('Every month');
    expect(within(card).getByTestId('subscription-next')).toHaveTextContent('Next delivery Nov 19, 2026');
    expect(card).toHaveTextContent('Product l1');
    expect(card).toHaveTextContent('50 capsules');
    expect(within(card).getByTestId('subscription-total')).toHaveTextContent('$44.10 per delivery');
    expect(within(card).getByTestId('subscription-status')).toHaveTextContent('Active');
  });

  it('Fixed shows the price stays the same', async () => {
    setup();
    expect(await screen.findByText('Your price stays the same for every delivery.')).toBeInTheDocument();
  });

  it('Skip: next date and toast', async () => {
    const user = userEvent.setup();
    const { calls } = setup({ put: () => subscription({ pendingSkips: 1, nextOrderDate: '2026-12-19T08:00:00.000Z' }) });
    await user.click(await screen.findByRole('button', { name: 'Skip next' }));
    expect(await screen.findByText('Next delivery Dec 19, 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Next delivery skipped').length).toBeGreaterThan(0);
    expect(puts(calls)).toHaveLength(1);
    expect(JSON.parse(String(puts(calls)[0].init?.body))).toEqual({ action: 'skip' });
  });

  it('Skip disabled while a skip is pending', async () => {
    setup({ list: [subscription({ pendingSkips: 1 })] });
    expect(await screen.findByRole('button', { name: 'Skip next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change interval' })).toBeDisabled();
    expect(screen.getByTestId('subscription-skipped')).toHaveTextContent('Next delivery skipped');
  });

  it('a canceled subscription does not claim a skipped delivery (found by Q in the browser, J4)', async () => {
    setup({ list: [subscription({ state: 'canceled', pendingSkips: 1, nextOrderDate: null })] });
    expect(await screen.findByRole('link', { name: 'Subscribe again' })).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-skipped')).toBeNull();
  });

  it('Paused: card says no further orders and offers Resume', async () => {
    const user = userEvent.setup();
    const { calls } = setup({
      list: [subscription({ state: 'paused', nextOrderDate: null })],
      put: () => subscription(),
    });
    expect(await screen.findByText('No further orders until you resume.')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('Paused');
    expect(screen.queryByRole('button', { name: 'Skip next' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByTestId('subscription-next')).toBeInTheDocument();
    expect(JSON.parse(String(puts(calls)[0].init?.body))).toEqual({ action: 'resume' });
  });

  it('Pause sends pause and the card renders the answer', async () => {
    const user = userEvent.setup();
    setup({ put: () => subscription({ state: 'paused', nextOrderDate: null }) });
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('No further orders until you resume.')).toBeInTheDocument();
  });

  it('Schedule changed in place: Change interval keeps the same card', async () => {
    const user = userEvent.setup();
    const { calls } = setup({ put: () => subscription({ policyId: POLICY_2W, schedule: { unit: 'Weeks', value: 2 }, version: 4 }) });
    await user.click(await screen.findByRole('button', { name: 'Change interval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change interval' });
    const current = within(dialog).getByRole('radio', { name: /Every month/ });
    expect(current).toBeChecked();
    expect(within(dialog).getByText('Current')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: /Every 2 weeks/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('subscription-interval')).toHaveTextContent('Every 2 weeks'));
    expect(screen.getAllByTestId('subscription-card')).toHaveLength(1);
    expect(JSON.parse(String(puts(calls)[0].init?.body))).toEqual({ action: 'setInterval', recurrencePolicyId: POLICY_2W });
    expect(puts(calls)[0].url).toContain(RO_ID);
  });

  it('Canceled: dialog states the last order date', async () => {
    const user = userEvent.setup();
    const { calls } = setup({
      list: [subscription({ lastOrderDate: '2026-10-19T08:00:00.000Z' })],
      put: () => subscription({ state: 'canceled', nextOrderDate: null, lastOrderDate: '2026-10-19T08:00:00.000Z' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this subscription?' });
    expect(within(dialog).getByTestId('cancel-text')).toHaveTextContent('No further orders will be created. Your last order was on Oct 19, 2026.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByText('Subscription canceled. Your last order was on Oct 19, 2026.')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('Canceled');
    expect(screen.getByRole('link', { name: 'Subscribe again' })).toHaveAttribute('href', '/p/pods/SKU-l1');
    expect(JSON.parse(String(puts(calls)[0].init?.body))).toEqual({ action: 'cancel' });
  });

  it('Cancel with no order yet says so', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByTestId('cancel-text')).toHaveTextContent('No further orders will be created. No order has been created from it yet.');
  });

  it('focus returns to the opening button', async () => {
    const user = userEvent.setup();
    setup();
    const open = await screen.findByRole('button', { name: 'Cancel' });
    await user.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this subscription?' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep subscription' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(open).toHaveFocus());
  });

  it('a refused change shows the error toast and keeps the card', async () => {
    const user = userEvent.setup();
    setup({ put: () => Response.json({ error: { code: 'invalid_state', message: 'x' } }, { status: 422 }) });
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('That did not work. Please try again.')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('Active');
  });

  it('Failed state shows Needs attention', async () => {
    setup({ list: [subscription({ state: 'failed' })] });
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).getByTestId('subscription-status')).toHaveTextContent('Needs attention');
    expect(card).toHaveTextContent('We could not create your last order.');
    expect(within(card).getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(within(card).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Skip next' })).toBeNull();
  });

  it('status is text not colour only and a custom schedule is labelled', async () => {
    setup({ list: [subscription({ schedule: null })] });
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).getByTestId('subscription-status').textContent).toBe('Active');
    expect(within(card).getByTestId('subscription-interval')).toHaveTextContent('Custom schedule');
  });

  it('buttons are 44px under 520', async () => {
    setup();
    for (const name of ['Skip next', 'Change interval', 'Pause', 'Cancel']) {
      const cls = (await screen.findByRole('button', { name })).className;
      expect(cls).toContain('max-[519px]:min-h-11');
      expect(cls).toContain('max-[519px]:w-full');
    }
  });

  it('several lines show a +N more badge', async () => {
    const base = subscription();
    setup({ list: [subscription({ lines: [base.lines[0], { ...base.lines[0], lineId: 'l2', name: 'Second' }] })] });
    expect(await screen.findByText('+1 more')).toBeInTheDocument();
  });

  it('Empty state offers Shop coffee', async () => {
    setup({ list: [] });
    const empty = await screen.findByTestId('subscriptions-empty');
    expect(empty).toHaveTextContent('No subscriptions yet');
    expect(within(empty).getByRole('link', { name: 'Shop coffee' })).toHaveAttribute('href', '/shop');
  });

  it('Loading shows the skeleton with aria-busy', async () => {
    setup();
    expect(await screen.findByTestId('subscriptions-loading')).toHaveAttribute('aria-busy', 'true');
    await screen.findByTestId('subscription-card');
  });

  it('Error state offers Try again', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/recurring-orders': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(<SubscriptionsTab />);
    const error = await screen.findByTestId('subscriptions-error');
    expect(error).toHaveTextContent('We could not load your subscriptions.');
    const before = stub.calls.length;
    await user.click(within(error).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(stub.calls.length).toBeGreaterThan(before));
  });

  it('Pending card links to contact', async () => {
    setup({ list: [], pending: [{ orderId: 'o-2', orderNumber: 'MC-10043', placedAt: '2026-10-19T08:02:00.000Z', lines: [{ name: 'x', quantity: 1, policyId: POLICY_1M }] }] });
    const card = await screen.findByTestId('pending-subscription');
    expect(card).toHaveTextContent('Subscription pending');
    expect(card).toHaveTextContent('We placed your order MC-10043 and are still setting up the subscription.');
    expect(within(card).getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();
    await screen.findByTestId('subscription-card');
    await expectNoAxeViolations(container);
  });
});
