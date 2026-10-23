import { afterEach, describe, expect, it, vi } from 'vitest';
import { orderView } from '@/test/checkout';

const ensure = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/ct/order-type', () => ({ ensureOrderType: ensure }));
vi.mock('@/lib/checkout/subscription-hook', () => ({ logSubscriptionExpected: async () => undefined }));

import { postOrderHooks } from './post-order';

afterEach(() => {
  vi.unstubAllEnvs();
  ensure.mockClear();
});

const runAll = async () => {
  for (const hook of postOrderHooks) await hook(orderView());
};

describe('Post-order hooks (workstream R)', () => {
  it('in the In-store companion the order type is ensured on the placed order', async () => {
    vi.stubEnv('APP_MODE', 'instore');
    await runAll();
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith(expect.objectContaining({ id: 'ord-1' }));
  });

  it('the website never touches the order type', async () => {
    vi.stubEnv('APP_MODE', 'website');
    await runAll();
    expect(ensure).not.toHaveBeenCalled();
  });
});
