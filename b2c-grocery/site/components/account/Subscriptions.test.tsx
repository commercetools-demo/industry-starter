import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecurringOrderSummary } from '@/lib/types';
import { summary } from '@/test/recurring';
import { renderWithProviders } from '@/test/utils';
import { Subscriptions } from './Subscriptions';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const POLICIES = [
  { key: 'weekly', name: 'Every week' },
  { key: 'every-2-weeks', name: 'Every 2 weeks' },
  { key: 'monthly', name: 'Every month' },
];

/** A tiny stateful server: orders change the way the API changes them (same id every time). */
function stubServer(initial: RecurringOrderSummary[], options: { failWrites?: boolean } = {}) {
  let orders = [...initial];
  const writes: { url: string; body: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/account/recurring' && method === 'GET') return json({ recurringOrders: orders, policies: POLICIES });
    if (method === 'PATCH' && url.startsWith('/api/account/recurring/')) {
      const id = decodeURIComponent(url.split('/')[4]);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      writes.push({ url, body });
      if (options.failWrites) return json({ error: 'RECURRING_ERROR' }, 500);
      orders = orders.map((o) => {
        if (o.id !== id) return o;
        switch (body.action) {
          case 'set-cadence': {
            const policy = POLICIES.find((p) => p.key === body.policyKey)!;
            return { ...o, policyKey: policy.key, cadenceLabel: policy.name, nextOrderAt: '2026-11-06T10:00:00.000Z' };
          }
          case 'set-quantity':
            return { ...o, lines: o.lines.map((l) => (l.id === body.lineId ? { ...l, quantity: body.quantity as number } : l)) };
          case 'pause':
            return { ...o, state: 'Paused', stateRaw: 'Paused', nextOrderAt: undefined };
          case 'resume':
            return { ...o, state: 'Active', stateRaw: 'Active', nextOrderAt: '2026-10-27T10:00:00.000Z' };
          default:
            return { ...o, state: 'Canceled', stateRaw: 'Canceled', nextOrderAt: undefined, lastOrderAt: '2026-10-13T10:00:00.000Z' };
        }
      });
      return json({ recurringOrder: orders.find((o) => o.id === id) });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { writes, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('Subscriptions page body', () => {
  it('Active recurring order: items, cadence, state and the next order date', async () => {
    stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).getByRole('heading', { level: 3, name: /Every 2 weeks/ })).toBeInTheDocument();
    expect(within(card).getByText('Active')).toBeInTheDocument();
    expect(within(card).getByText('Whole milk 1 L')).toBeInTheDocument();
    expect(within(card).getByRole('status')).toHaveTextContent('2');
    expect(within(card).getByTestId('next-order')).toHaveTextContent('Next order: Oct 20, 2026');
    expect(within(card).getByText('Last order: Oct 6, 2026')).toBeInTheDocument();
    expect(screen.getByText(/Changes apply from the next order/)).toBeInTheDocument();
  });

  it('German dates and labels follow the locale', async () => {
    stubServer([summary({ cadenceLabel: 'Alle 2 Wochen' })]);
    renderWithProviders(<Subscriptions />, { locale: 'de-DE' });
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).getByTestId('next-order')).toHaveTextContent('Nächste Bestellung: 20.10.2026');
    expect(within(card).getByText('Aktiv')).toBeInTheDocument();
  });

  it('Empty state: a message and a link to the shop', async () => {
    stubServer([]);
    renderWithProviders(<Subscriptions />);
    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.queryByTestId('subscription-card')).not.toBeInTheDocument();
  });

  it('load failure: a message with retry instead of the empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'RECURRING_ERROR' }, 500)));
    renderWithProviders(<Subscriptions />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your subscriptions.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No subscriptions yet')).not.toBeInTheDocument();
  });

  it('Change cadence: the dialog saves on the same recurring order, the card shows the new schedule and next date', async () => {
    const { writes } = stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Change cadence' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Every 2 weeks')).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText('Every month'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ url: '/api/account/recurring/ro-1', body: { action: 'set-cadence', policyKey: 'monthly' } }]);
    const card = screen.getByTestId('subscription-card');
    expect(within(card).getByRole('heading', { level: 3, name: /Every month/ })).toBeInTheDocument();
    expect(within(card).getByTestId('next-order')).toHaveTextContent('Next order: Nov 6, 2026');
    expect(screen.getAllByTestId('subscription-card')).toHaveLength(1);
  });

  it('Change quantity: the stepper sends set-quantity for that line and shows the answer', async () => {
    const { writes } = stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Whole milk 1 L' }));
    await waitFor(() => expect(within(screen.getByTestId('subscription-card')).getByRole('status')).toHaveTextContent('3'));
    expect(writes[0].body).toEqual({ action: 'set-quantity', lineId: 'l-1', quantity: 3 });
  });

  it('Pause then resume: same order, state and next date follow', async () => {
    const { writes } = stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Paused: no upcoming order')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText('Next order: Oct 27, 2026')).toBeInTheDocument();
    expect(writes.map((w) => [w.url, w.body.action])).toEqual([
      ['/api/account/recurring/ro-1', 'pause'],
      ['/api/account/recurring/ro-1', 'resume'],
    ]);
  });

  it('Cancel: the confirmation states the last order date; confirming cancels and removes the actions', async () => {
    const { writes } = stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this subscription?' });
    expect(within(dialog).getByText('No further orders will be created. Your last order was on Oct 6, 2026.')).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes[0].body).toEqual({ action: 'cancel' });
    const card = screen.getByTestId('subscription-card');
    expect(within(card).getByText('Canceled: no more orders')).toBeInTheDocument();
    expect(within(card).getByText('Last order: Oct 13, 2026')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Change cadence' })).not.toBeInTheDocument();
  });

  it('Cancel: "Keep subscription" closes the dialog and sends nothing', async () => {
    const { writes } = stubServer([summary()]);
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep subscription' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('a failed change shows a message and leaves the card as it was', async () => {
    stubServer([summary()], { failWrites: true });
    renderWithProviders(<Subscriptions />);
    await screen.findByTestId('subscription-card');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work. Please try again.');
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('a Canceled recurring order is read-only: no stepper, no actions', async () => {
    stubServer([summary({ state: 'Canceled', stateRaw: 'Canceled', nextOrderAt: undefined })]);
    renderWithProviders(<Subscriptions />);
    const card = await screen.findByTestId('subscription-card');
    expect(within(card).queryByRole('group')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(within(card).getByText('× 2')).toBeInTheDocument();
  });
});
