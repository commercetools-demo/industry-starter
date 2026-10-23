import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscription } from '@/test/recurring';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import OrderSubscriptionCard from '@/components/order/OrderSubscriptionCard';
import type { Subscription } from '@/lib/types';
import { orderView } from '@/test/checkout';
import { renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const schedule = { unit: 'Months' as const, value: 1 };

function order(over: Record<string, unknown> = {}) {
  const base = orderView();
  const line = base.lines[0];
  return { ...base, id: 'o-1', customerId: 'c1', lines: [line], subscriptions: [{ lineId: line.id, schedule }], ...over };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Confirmation note', () => {
  it('confirmation shows next delivery when the subscription exists', async () => {
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer }), '/api/recurring-orders': () => ({ subscriptions: [subscription()], pending: [] }) });
    renderShell(<OrderSubscriptionCard order={order()} />);
    expect(await screen.findByText('Your subscription starts now. Next delivery Nov 19, 2026, then every month. Manage it in your account.')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/recurring-orders?originOrderId=o-1')).toBe(true);
  });

  it('confirmation says setting up then late message', async () => {
    let list: Subscription[] = [];
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer }), '/api/recurring-orders': () => ({ subscriptions: list, pending: [] }) });
    renderShell(<OrderSubscriptionCard order={order()} />);
    expect(await screen.findByText('We are setting up your subscription.')).toBeInTheDocument();
    const reads = () => calls.filter((c) => c.url.startsWith('/api/recurring-orders')).length;
    const first = reads();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(reads()).toBeGreaterThan(first);

    // The subscription appears on the next retry.
    list = [subscription()];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(await screen.findByTestId('subscription-note')).toHaveTextContent('Next delivery Nov 19, 2026');
  });

  it('shows the late message when the platform never creates it', async () => {
    stubFetch({ '/api/auth/me': () => ({ customer }), '/api/recurring-orders': () => ({ subscriptions: [], pending: [] }) });
    renderShell(<OrderSubscriptionCard order={order()} />);
    expect(await screen.findByText('We are setting up your subscription.')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16500);
    });
    expect(screen.getByText('We could not confirm your subscription yet. It will appear in your account; contact us if it does not.')).toBeInTheDocument();
  });

  it('no note on an order without subscribe lines', () => {
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer }) });
    renderShell(<OrderSubscriptionCard order={order({ subscriptions: [] })} />);
    expect(screen.queryByTestId('subscription-note')).toBeNull();
    expect(calls.filter((c) => c.url.startsWith('/api/recurring-orders'))).toHaveLength(0);
  });

  it('guest order never shows the note', () => {
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer: null }) });
    renderShell(<OrderSubscriptionCard order={order({ customerId: null })} />);
    expect(screen.queryByTestId('subscription-note')).toBeNull();
    expect(calls.filter((c) => c.url.startsWith('/api/recurring-orders'))).toHaveLength(0);
  });
});
