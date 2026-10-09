import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'orders' }),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const read = vi.fn();
vi.mock('@/lib/ct/orders-read', () => ({ getOrderForCustomer: (...a: unknown[]) => read(...a) }));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({ ...(await (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>())), notFound: () => notFound() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import ProtectedLayout from '../layout';
import OrderNotFound from './not-found';
import OrderUnknownRoute from './page';
import OrderRoute from './[id]/page';

const order = { id: 'o1', orderNumber: 'MLV-000007', status: 'pharmacist-review', shipmentState: null, createdAt: '2026-10-08T10:00:00Z', lines: [{ name: 'Atorvastatin 20 mg', quantity: 1 }], deliverTo: null, sameDay: false, total: { centAmount: 900, currencyCode: 'USD', fractionDigits: 2 }, refund: 'none', cancellable: true };
const params = (id: string) => Promise.resolve({ locale: 'en-US', id });

beforeEach(() => {
  setPathname('/en-US/order/o1');
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  read.mockReset().mockResolvedValue(order);
  notFound.mockClear();
});

describe('order-confirmation-page: the /order/<id> page', () => {
  it('Order placed: renders from the order read for the session customer', async () => {
    renderWithProviders(<>{await ProtectedLayout({ children: await OrderRoute({ params: params('o1') }) })}</>);
    expect(read).toHaveBeenCalledWith('o1', 'c1', 'en-US');
    expect(screen.getByText('MLV-000007')).toBeInTheDocument();
    expect(screen.getByText('Order placed')).toBeInTheDocument();
  });

  it('Revisited later: a second render reads the order again and shows its current state', async () => {
    renderWithProviders(<>{await OrderRoute({ params: params('o1') })}</>);
    read.mockResolvedValue({ ...order, status: 'packed-shipped' });
    renderWithProviders(<>{await OrderRoute({ params: params('o1') })}</>);
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Packed and shipped').length).toBeGreaterThan(0);
  });

  it('signed out: "Sign in to view your order." and nothing is read', async () => {
    getSession.mockResolvedValue({});
    renderWithProviders(<>{await ProtectedLayout({ children: await OrderRoute({ params: params('o1') }) })}</>);
    expect(screen.getByText('Sign in to view your order.')).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });

  it("Other patient's order: an order the read does not return is a 404 with the one \"Order not found.\" card", async () => {
    read.mockResolvedValue(null);
    await expect(OrderRoute({ params: params('someone-elses') })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
    renderWithProviders(<OrderNotFound />);
    expect(screen.getByRole('heading', { name: 'Order not found.' })).toBeInTheDocument();
  });
});

describe('order-confirmation-page: Placement outcome unknown', () => {
  it('shows "Check your orders", never says the order was placed, reads no order', async () => {
    renderWithProviders(<>{await OrderUnknownRoute({ params: Promise.resolve({ locale: 'en-US' }) })}</>);
    expect(screen.getByRole('link', { name: 'Check your orders' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(screen.queryByText(/Order placed/)).not.toBeInTheDocument();
    expect(screen.queryByText('Your medication is on its way.')).not.toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
  });
});
