import { screen } from '@testing-library/react';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { mapOrder } from '@/lib/mappers/order';
import { orderA, orderDevice } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { CancellationNotice } from './CancellationNotice';
import { OrderActions } from './OrderActions';

vi.mock('@/hooks/useOrderActions', () => ({ useOrderActions: () => ({ cancel: vi.fn(), requestReturn: vi.fn() }) }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const NOW = '2026-03-07T12:00:00.000Z'; // order A starts its service on 2026-03-12
const view = (ct: CtOrder, nowIso = NOW, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<OrderActions order={mapOrder(ct, locale)} nowIso={nowIso} />, { locale });
const patched = (ct: CtOrder, patch: Record<string, unknown>) => ({ ...ct, ...patch }) as unknown as CtOrder;

describe('OrderActions: cancel box', () => {
  it('names the last day one day before the service start date and offers the button', () => {
    view(orderA());
    expect(screen.getByText('You can cancel this order until March 11, 2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact support' })).not.toBeInTheDocument();
  });

  it('writes the date in German for a German buyer', () => {
    view(orderA(), NOW, 'de-DE');
    expect(screen.getByText('Sie können diese Bestellung bis zum 11. März 2026 stornieren.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestellung stornieren' })).toBeInTheDocument();
  });

  it.each([
    ['the service has started', NOW.replace('03-07', '03-12'), {}, "Your service has started, so this order can't be cancelled online."],
    ['the equipment has shipped', NOW, { shipmentState: 'Shipped' }, "Your equipment has already shipped, so this order can't be cancelled online."],
    ['a return exists', NOW, { returnInfo: [{ items: [{ id: 'r', type: 'LineItemReturnItem', lineItemId: 'a1', quantity: 1, shipmentState: 'Advised', paymentState: 'NonRefundable' }] }] }, "This order has a return request, so it can't be cancelled online."],
  ])('explains why it cannot be cancelled when %s, with a link to support', (_name, nowIso, patch, message) => {
    view(patched(orderA(), patch), nowIso);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', '/en-US/support');
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('a phone-only order starts its service today and cannot be cancelled online', () => {
    view(orderDevice(), '2026-05-02T12:00:00.000Z');
    expect(screen.getByText("Your service has started, so this order can't be cancelled online.")).toBeInTheDocument();
  });

  it('renders no box for a cancelled order', () => {
    view(patched(orderA(), { orderState: 'Cancelled' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('OrderActions: return box', () => {
  const MAY = '2026-05-10T12:00:00.000Z'; // the device order was placed on 2026-05-02
  it('offers the return of a device until 30 days after the order date', () => {
    view(orderDevice(), MAY);
    expect(screen.getByText('You can return a device until June 1, 2026 (30 days after ordering).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return a device' })).toBeInTheDocument();
  });

  it('says the window has ended', () => {
    view(orderDevice(), '2026-06-02T12:00:00.000Z');
    expect(screen.getByText('The 30-day return window for this order has ended.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return a device' })).not.toBeInTheDocument();
  });

  it('says every device already has a return request', () => {
    const returned = patched(orderDevice(), { returnInfo: [{ items: [{ id: 'r', type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, shipmentState: 'Advised', paymentState: 'NonRefundable' }] }] });
    view(returned, MAY);
    expect(screen.getByText('Every device on this order already has a return request.')).toBeInTheDocument();
  });

  it('shows no return box for an order without a device or for a cancelled order', () => {
    view(orderA());
    expect(screen.queryByText(/return/i)).not.toBeInTheDocument();
  });

  it('hides the return box on a cancelled order', () => {
    view(patched(orderDevice(), { orderState: 'Cancelled' }), MAY);
    expect(screen.queryByRole('button', { name: 'Return a device' })).not.toBeInTheDocument();
  });
});

describe('CancellationNotice', () => {
  const cancelled = (record: unknown) => {
    const base = orderA();
    return patched(base, { orderState: 'Cancelled', custom: { ...base.custom, fields: { ...(base.custom?.fields as object), cancellation: JSON.stringify(record) } } });
  };

  it('shows when, why and the note, and that nothing more is charged', () => {
    renderWithProviders(<CancellationNotice order={mapOrder(cancelled({ reason: 'other', note: 'moving abroad', cancelledAt: '2026-03-08T10:00:00.000Z', by: 'customer' }), 'en-US')} />);
    expect(screen.getByText('This order was cancelled on Mar 8, 2026.')).toBeInTheDocument();
    expect(screen.getByText('Reason: Other')).toBeInTheDocument();
    expect(screen.getByText(/moving abroad/)).toBeInTheDocument();
    expect(screen.getByText('No further charges will be made.')).toBeInTheDocument();
  });

  it('still says it is cancelled when the record cannot be read', () => {
    renderWithProviders(<CancellationNotice order={mapOrder(patched(orderA(), { orderState: 'Cancelled' }), 'en-US')} />);
    expect(screen.getByText('This order was cancelled.')).toBeInTheDocument();
  });

  it('renders nothing for an order that is not cancelled', () => {
    renderWithProviders(<CancellationNotice order={mapOrder(orderA(), 'en-US')} />);
    expect(screen.queryByText(/cancelled/)).not.toBeInTheDocument();
  });
});
