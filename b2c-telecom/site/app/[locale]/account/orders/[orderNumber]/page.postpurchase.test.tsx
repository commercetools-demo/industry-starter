import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { mapOrder } from '@/lib/mappers/order';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { orderA, orderDevice } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';

type CtOrder = ReturnType<typeof orderDevice>;

const state = vi.hoisted(() => ({ session: {} as { customerId?: string }, getCustomer: vi.fn(), getOrder: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: string | { locale: string; namespace: string }) =>
    typeof arg === 'string' ? createTranslator({ locale: 'en-US', messages: enMessages, namespace: arg as never }) : createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT /${locale}${href}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: state.getCustomer, sessionsValidAfterOf: () => undefined }));
vi.mock('@/lib/ct/orders', () => ({ getOrderForCustomer: state.getOrder }));

import OrderPage from './page';

const props = (orderNumber: string) => ({ params: Promise.resolve({ locale: 'en-US', orderNumber }) });
const patched = (ct: CtOrder, patch: Record<string, unknown>) => ({ ...ct, ...patch }) as unknown as CtOrder;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-03-07T12:00:00Z'));
  state.session = { customerId: 'cust-alex' };
  state.getCustomer.mockResolvedValue({ id: 'cust-alex', email: 'a@b.c', firstName: 'Alex', lastName: 'Rivera', addresses: [] });
  state.getOrder.mockResolvedValue(mapOrder(orderA(), 'en-US'));
});
afterEach(() => vi.useRealTimers());

describe('order detail page: post-purchase', () => {
  it('an open order shows the cancel box and no cancellation notice', async () => {
    renderWithProviders(await OrderPage(props('QA-AAAA01')));
    expect(screen.getByText('You can cancel this order until March 11, 2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(screen.queryByText(/This order was cancelled/)).not.toBeInTheDocument();
  });

  it('a cancelled order shows the notice and no cancel box', async () => {
    const base = orderA();
    const record = { reason: 'moving', cancelledAt: '2026-03-06T10:00:00.000Z', by: 'customer' };
    const cancelled = patched(base, { orderState: 'Cancelled', custom: { ...base.custom, fields: { ...(base.custom?.fields as object), cancellation: JSON.stringify(record) } } });
    state.getOrder.mockResolvedValue(mapOrder(cancelled, 'en-US'));
    renderWithProviders(await OrderPage(props('QA-AAAA01')));
    expect(screen.getByText('This order was cancelled on Mar 6, 2026.')).toBeInTheDocument();
    expect(screen.getByText("Reason: I'm moving")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('an order with returns shows the returns section, the shipments section and the return box', async () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const withReturn = patched(orderDevice(), {
      shippingInfo: { deliveries: [{ id: 'del-1', createdAt: '2026-05-03T09:00:00.000Z', items: [{ id: 'd2', quantity: 1 }], parcels: [{ id: 'p1', createdAt: '2026-05-03T09:00:00.000Z', trackingData: { trackingId: 'DP000111', carrier: 'DemoPost' } }] }] },
      returnInfo: [{ returnDate: '2026-05-04T00:00:00.000Z', items: [{ id: 'ri-1', type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, shipmentState: 'Advised', paymentState: 'NonRefundable' }] }],
    });
    state.getOrder.mockResolvedValue(mapOrder(withReturn, 'en-US'));
    renderWithProviders(await OrderPage(props('QA-DDDD04')));
    expect(screen.getByRole('heading', { level: 2, name: 'Returns' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Shipments' })).toBeInTheDocument();
    expect(screen.getByText('DP000111')).toBeInTheDocument();
    expect(screen.getByText('Every device on this order already has a return request.')).toBeInTheDocument();
    expect(screen.getByText("This order has a return request, so it can't be cancelled online.")).toBeInTheDocument();
  });

  it('a foreign or guest order is not found, as before', async () => {
    state.getOrder.mockResolvedValue(null);
    await expect(OrderPage(props('QA-OTHER1'))).rejects.toThrow('NOT_FOUND');
  });
});
