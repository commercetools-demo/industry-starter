import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'account' }),
}));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ customerId: 'c1' }) }));
vi.mock('@/lib/ct/orders-read', () => ({ listOrdersForCustomer: async () => [] }));
const redirect = vi.fn((_: unknown) => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), redirect: (a: unknown) => redirect(a) }));

import LabsAlias from './page';
import OrdersPage from '../(protected)/account/orders/page';

describe('design-account-area: Lab tests, List (alias)', () => {
  it('/labs redirects to /account/labs', async () => {
    await expect(LabsAlias({ params: Promise.resolve({ locale: 'en-US' }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/account/labs', locale: 'en-US' });
  });
});

describe('design-account-area: Orders (no orders yet; the list is workstream S)', () => {
  it('Empty: "No orders yet." with an "Order from a prescription" link to /prescriptions', async () => {
    setPathname('/en-US/account/orders');
    renderWithProviders(<>{await OrdersPage({ params: Promise.resolve({ locale: 'en-US' }) })}</>);
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Order from a prescription' })).toHaveAttribute('href', '/en-US/prescriptions');
  });
});
