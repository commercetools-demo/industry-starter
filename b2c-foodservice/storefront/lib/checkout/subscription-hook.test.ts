import { afterEach, describe, expect, it, vi } from 'vitest';
import { postOrderHooks } from '@/lib/checkout/post-order';
import { logSubscriptionExpected } from '@/lib/checkout/subscription-hook';
import { orderView } from '@/test/checkout';

afterEach(() => vi.restoreAllMocks());

describe('subscription post-order hook', () => {
  it('is registered with K and logs ids and counts only for an order with subscribe lines', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(postOrderHooks).toContain(logSubscriptionExpected);
    const base = orderView();
    const line = { ...base.lines[0], recurrence: { unit: 'Months' as const, value: 1 } };
    await logSubscriptionExpected({ ...base, lines: [line, { ...line, id: 'l2' }] });
    const logged = String(info.mock.calls[0][0]);
    expect(JSON.parse(logged)).toEqual({ event: 'subscription_expected', orderId: 'ord-1', subscribeLines: 2, schedules: 1 });
    expect(logged).not.toContain('maya@example.com');
  });

  it('stays silent for an order without subscribe lines', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await logSubscriptionExpected(orderView());
    expect(info).not.toHaveBeenCalled();
  });
});
