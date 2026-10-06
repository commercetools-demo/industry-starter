import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/ct/orders', () => ({ getOrderById: vi.fn() }));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default;
  const { createTranslator } = await import('next-intl');
  return {
    setRequestLocale: vi.fn(),
    getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: 'en-US', messages, namespace: namespace as never }),
  };
});

import ConfirmationPage from './page';
import { getOrderById } from '@/lib/ct/orders';
import { getSession } from '@/lib/session';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const order = (over: Partial<Order> = {}): Order => ({
  id: 'order-1',
  orderNumber: 'MLV-2261',
  createdAt: '2026-10-05T10:30:00.000Z',
  status: 'processing',
  statusRaw: 'Open',
  lines: [],
  subtotal: usd(497),
  total: usd(997),
  isProvisional: false,
  inventoryMode: 'None',
  version: 1,
  customerId: 'cust-1',
  slot: { id: '20261013-10', start: '2026-10-13T10:00:00.000Z', end: '2026-10-13T12:00:00.000Z' },
  ...over,
});
const params = Promise.resolve({ locale: 'en-US', orderId: 'order-1' });
const render = async () => renderWithProviders(await ConfirmationPage({ params }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrderById).mockResolvedValue(order());
});

describe('confirmation page', () => {
  it('Track order: the owner sees number, thank-you name, slot and the Track button', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1', customerFirstName: 'Camille' });
    await render();
    expect(screen.getByTestId('confirmation-kicker')).toHaveTextContent('Order MLV-2261');
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you, Camille' })).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-slot')).toHaveTextContent(/10:00–12:00/);
    expect(screen.getByRole('link', { name: 'Track this order' })).toHaveAttribute('href', expect.stringContaining('/account/orders/order-1'));
    expect(screen.getByRole('link', { name: 'Back to the shop' })).toBeInTheDocument();
    expect(screen.queryByTestId('guest-number')).toBeNull();
    expect(getOrderById).toHaveBeenCalledWith('order-1', 'en-US');
  });

  it('Guest: allowed through lastOrderId, no Track button, the number is shown, name from the order address', async () => {
    vi.mocked(getSession).mockResolvedValue({ lastOrderId: 'order-1' });
    vi.mocked(getOrderById).mockResolvedValue(order({ customerId: undefined, shippingAddress: { country: 'US', firstName: 'Guesty' } }));
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you, Guesty' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Track this order' })).toBeNull();
    expect(screen.getByTestId('guest-number')).toHaveTextContent('MLV-2261');
  });

  it('Unknown order id: not found', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getOrderById).mockResolvedValue(null);
    await expect(ConfirmationPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it("Another customer's order: not found", async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-2' });
    await expect(ConfirmationPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('Anonymous visitor without lastOrderId: not found; another last order does not help', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    await expect(ConfirmationPage({ params })).rejects.toThrow('NOT_FOUND');
    vi.mocked(getSession).mockResolvedValue({ lastOrderId: 'other' });
    await expect(ConfirmationPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('a guest order is not opened by an anonymous visitor even with undefined customer ids on both sides', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    vi.mocked(getOrderById).mockResolvedValue(order({ customerId: undefined }));
    await expect(ConfirmationPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('Weighed item in bag: provisional total and notice', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getOrderById).mockResolvedValue(order({ isProvisional: true }));
    await render();
    expect(screen.getByTestId('confirmation-total')).toHaveTextContent('Total (provisional): $9.97');
    expect(screen.getByTestId('provisional-note')).toBeInTheDocument();
  });

  it('exact order: no provisional notice', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    await render();
    expect(screen.getByTestId('confirmation-total')).toHaveTextContent('Total: $9.97');
    expect(screen.queryByTestId('provisional-note')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you' })).toBeInTheDocument();
  });
});
