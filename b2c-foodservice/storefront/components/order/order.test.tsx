import { screen, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { orderView } from '@/test/checkout';
import { renderWithIntl } from '@/test/render';
import enUS from '@/messages/en-US.json';
import enCA from '@/messages/en-CA.json';
import type { OrderState, OrderView } from '@/lib/types';
import type { ReactElement } from 'react';

const h = vi.hoisted(() => ({ getOrderView: vi.fn(), getSession: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/ct/orders', () => ({ getOrderView: h.getOrderView }));
vi.mock('@/lib/session', () => ({ getSession: h.getSession }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('@/i18n/routing', async () => ({ ...(await (await import('@/test/shell')).routingMock()), redirect: h.redirect }));

import OrderConfirmation from '@/components/order/OrderConfirmation';
import OrderStatusTrack, { nodeStates } from '@/components/order/OrderStatusTrack';
import NoRecentOrder from '@/components/order/NoRecentOrder';
import { pollInterval, ORDER_POLL_MS } from '@/hooks/useOrderStatus';
import ConfirmationRoute from '@/app/[locale]/checkout/confirmation/[orderId]/page';
import ConfirmationIndex from '@/app/[locale]/checkout/confirmation/page';

const store = { storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', address: '1 Prince St, New York', hours: '08:00–18:00', phone: '+1 212 555 0101', readyMinutes: 15, pickupName: 'Maya Lopez' };
const collectLine = { id: 'c1', name: 'Pod box', variantSummary: '', quantity: 1, imageUrl: null, fulfilment: 'collect' as const, storeKey: store.storeKey, recurrence: null, priceCents: 1000 };
const shipLine = { id: 'l1', name: 'Machine', variantSummary: '', quantity: 1, imageUrl: null, fulfilment: 'delivery' as const, storeKey: null, recurrence: null, priceCents: 9000 };
const subLine = { id: 's1', name: 'Dark Roast', variantSummary: '', quantity: 1, imageUrl: null, fulfilment: 'subscribe' as const, storeKey: null, recurrence: { unit: 'Weeks' as const, value: 2 }, priceCents: 1500 };

const render = (order: OrderView, guest = true, locale = 'en-US') =>
  renderWithIntl(
    <SWRConfig value={{ provider: () => new Map(), fallback: {} }}>
      <OrderConfirmation initial={order} guest={guest} />
    </SWRConfig>,
    { locale },
  );

describe('confirmation (K-13)', () => {
  it('Order placed: reference, totals and next steps come from the order', () => {
    render(orderView({ collect: [store], lines: [collectLine, shipLine], state: 'ordered' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Order confirmed' })).toHaveFocus();
    expect(screen.getByTestId('order-number-line')).toHaveTextContent('Order MC-ABCDEFGHJK · maya@example.com');
    expect(screen.getByTestId('order-number-line').querySelector('.font-mono')?.textContent).toBe('MC-ABCDEFGHJK');
    expect(screen.getByTestId('order-total')).toHaveTextContent('$33.71');
    const card = screen.getByTestId('collection-card');
    expect(within(card).getByText('Collect at Malva SoHo')).toBeInTheDocument();
    expect(within(card).getByText('Pickup name: Maya Lopez')).toBeInTheDocument();
    expect(within(card).getByText('Bring a photo ID and your order number.')).toBeInTheDocument();
    expect(within(card).getByText('Keep this number; you will need it to collect your order.')).toBeInTheDocument();
  });
  it('Guest: the email is shown and the account offer links to registration', () => {
    render(orderView());
    const offer = screen.getByTestId('guest-offer');
    expect(within(offer).getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/account/register');
  });
  it('a signed-in shopper gets no account offer', () => {
    render(orderView({ customerId: 'cust-1' }), false);
    expect(screen.queryByTestId('guest-offer')).toBeNull();
  });
  it('Confirmation never claims an email or text was sent', () => {
    const { container } = render(orderView({ collect: [store], lines: [collectLine], ship: null }));
    expect(container.textContent).not.toMatch(/\b(sent|emailed|we'll text|text message|confirmation email)\b/i);
    for (const catalogue of [enUS, enCA]) {
      const text = JSON.stringify(catalogue.order) + JSON.stringify(catalogue.checkout);
      expect(text).not.toMatch(/\bsent\b|emailed|we'll text|we will text|text you|email you/i);
    }
  });
  it('Shipped line: an estimate and "Tracking will appear here"', () => {
    render(orderView());
    const card = screen.getByTestId('shipping-card');
    expect(within(card).getByText('Estimated 2-4 business days')).toBeInTheDocument();
    expect(within(card).getByText('Tracking will appear here')).toBeInTheDocument();
  });
  it('a parcel with tracking shows the number and a link', () => {
    render(orderView({ ship: { methodName: 'Standard', estimate: null, address: 'x', deliveries: [{ id: 'd1', trackingId: '1Z999', trackingUrl: 'https://carrier.example/t/1Z999', carrier: 'UPS' }] } }));
    expect(screen.getByText('1Z999')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track parcel' })).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
  it('Canada order shows the delivery card and no tracker', () => {
    render(orderView({ currency: 'CAD', locale: 'en-CA', state: 'ordered' }), true, 'en-CA');
    expect(screen.getByTestId('shipping-card')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-card')).toBeNull();
    expect(screen.queryByTestId('order-track')).toBeNull();
    expect(screen.getByTestId('order-total').textContent).toContain('33.71');
  });
  it('a mixed order keeps every line under its marker and shows the collection and delivery cards', () => {
    render(orderView({ collect: [store], lines: [collectLine, shipLine, subLine], subscriptions: [{ lineId: 's1', schedule: { unit: 'Weeks', value: 2 } }] }));
    const items = screen.getByTestId('order-items');
    expect(items.querySelectorAll('[data-fulfilment]')).toHaveLength(3);
    expect(screen.getByTestId('collection-card')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-card')).toBeInTheDocument();
    expect(within(screen.getByTestId('subscription-card')).getByText(/Dark Roast · Delivers every 2 weeks/)).toBeInTheDocument();
  });
  it('linked orders of one purchase are listed', () => {
    render(orderView({ linked: [{ id: 'ord-2', orderNumber: 'MC-ABCDEFGHJK-B' }] }));
    expect(within(screen.getByTestId('linked-orders')).getByRole('link', { name: 'Order MC-ABCDEFGHJK-B' })).toHaveAttribute('href', '/checkout/confirmation/ord-2');
  });
  it('has no accessibility violations', async () => {
    const { container } = render(orderView({ collect: [store], lines: [collectLine, shipLine] }));
    await expectNoAxeViolations(container);
  });
});

describe('collection tracker', () => {
  const stateOf = (s: OrderState) => nodeStates(s);
  it('Status progress: each state gives its done and active nodes', () => {
    expect(stateOf('ordered')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(stateOf('preparing')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(stateOf('ready-for-collection')).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(stateOf('collected')).toEqual(['done', 'done', 'done', 'done']);
  });
  it('renders the state in words, not colour alone', () => {
    renderWithIntl(<OrderStatusTrack state="ready-for-collection" />);
    const list = screen.getByRole('list', { name: 'Collection progress' });
    expect(within(list).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'Ordered: done', 'Preparing: done', 'Ready: current', 'Collected: upcoming',
    ]);
  });
  it('null renders nothing', () => {
    const { container } = renderWithIntl(<OrderStatusTrack state={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('Ready: the confirmation shows the tracker from the order state', () => {
    render(orderView({ collect: [store], lines: [collectLine], ship: null, state: 'ready-for-collection' }));
    expect(screen.getByTestId('order-track')).toHaveAttribute('data-state', 'ready-for-collection');
  });
  it('Polling stops at collected, never starts for a delivery-only order', () => {
    expect(pollInterval({ state: 'ordered', collect: [store] })).toBe(ORDER_POLL_MS);
    expect(pollInterval({ state: 'preparing', collect: [store] })).toBe(ORDER_POLL_MS);
    expect(pollInterval({ state: 'collected', collect: [store] })).toBe(0);
    expect(pollInterval({ state: 'ordered', collect: [] })).toBe(0);
    expect(pollInterval({ state: null, collect: [store] })).toBe(0);
    expect(pollInterval(undefined)).toBe(0);
  });
});

describe('confirmation pages', () => {
  beforeEach(() => {
    h.getOrderView.mockReset();
    h.getSession.mockReset();
    h.redirect.mockReset();
    h.getSession.mockResolvedValue({});
  });
  const route = (orderId: string, locale = 'en-US') => ConfirmationRoute({ params: Promise.resolve({ locale, orderId }) }) as Promise<ReactElement>;

  it('No recent order: an unknown id and a malformed id both land on the empty state', async () => {
    h.getOrderView.mockResolvedValue(null);
    expect((await route('nope')).type).toBe(NoRecentOrder);
    expect((await route('a/../b')).type).toBe(NoRecentOrder);
    expect(h.getOrderView).toHaveBeenCalledTimes(1);
    h.getOrderView.mockRejectedValue(new Error('boom'));
    expect((await route('boom')).type).toBe(NoRecentOrder);
    expect(((await ConfirmationIndex({ params: Promise.resolve({ locale: 'en-US' }) })) as ReactElement).type).toBe(NoRecentOrder);
  });
  it('the empty state offers the shop', async () => {
    renderWithIntl(await NoRecentOrder({ locale: 'en-US' }));
    expect(screen.getByTestId('no-recent-order')).toBeInTheDocument();
  });
  it('Revisited later: a guest order renders from the stored order for whoever holds the id', async () => {
    h.getOrderView.mockResolvedValue(orderView());
    const el = await route('ord-1');
    expect(el.type).toBe(OrderConfirmation);
    expect(el.props).toMatchObject({ guest: true, initial: { id: 'ord-1' } });
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it('Member order needs the owning session: another session is sent to sign in and back', async () => {
    h.getOrderView.mockResolvedValue(orderView({ customerId: 'cust-1' }));
    h.getSession.mockResolvedValue({ customerId: 'cust-2' });
    h.redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    await expect(route('ord-1')).rejects.toThrow('NEXT_REDIRECT');
    expect(h.redirect).toHaveBeenCalledWith({ href: '/account/sign-in?redirect=%2Fcheckout%2Fconfirmation%2Ford-1', locale: 'en-US' });
    h.redirect.mockReset();
    h.getSession.mockResolvedValue({ customerId: 'cust-1' });
    const el = await route('ord-1');
    expect(el.props).toMatchObject({ guest: false });
  });
});
