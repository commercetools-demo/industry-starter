import { screen } from '@testing-library/react';
import { unstable_serialize } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { keyChannels } from '@/lib/cache-keys';
import { usd, viewCart, viewLine } from '@/test/cart';
import { podPage, renderPdp } from '@/test/pdp';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import userEvent from '@testing-library/user-event';
import CartPage from '@/components/cart/CartPage';

describe('Catalog price moved: the buyer is told which price applies', () => {
  it('Catalog price moved: Subscribe block tells the price stays the same', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage());
    await user.click(screen.getByRole('radio', { name: /Subscribe and save/ }));
    expect(screen.getByTestId('subscribe-price-lock')).toHaveTextContent('Your price stays the same for every delivery.');
  });

  it('Catalog price moved: Subscriptions group shows the price lock and shipping note', () => {
    const sub = viewLine({ id: 's', fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } } });
    const channels = { stores: [], selectedKey: null };
    stubFetch({ '/api/cart/count': () => ({ count: 1 }), '/api/channels': () => channels, '/api/cart': () => ({ cart: viewCart([sub]) }) });
    renderShell(<CartPage initialCart={viewCart([sub])} />, { fallback: { [unstable_serialize(keyChannels('US'))]: channels } });
    const note = screen.getByTestId('subscription-price-lock');
    expect(note).toHaveTextContent('Your price stays the same for every delivery.');
    expect(note).toHaveTextContent('Shipping is calculated for each delivery.');
  });
});
