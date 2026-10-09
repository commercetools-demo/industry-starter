import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (() => '') }));
const redirect = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), redirect: (a: unknown) => redirect(a) }));

import OrderUnknownRoute from './page';

const params = Promise.resolve({ locale: 'en-US' });

beforeEach(() => redirect.mockReset());

describe('order-confirmation-page: Checkout payment return URL (AA)', () => {
  it('Checkout appends ?orderId=<id> after a redirect-based payment: the buyer goes to that order, which finalizes lazily', async () => {
    await OrderUnknownRoute({ params, searchParams: Promise.resolve({ orderId: 'ord-1' }) });
    expect(redirect).toHaveBeenCalledWith({ href: '/order/ord-1', locale: 'en-US' });
  });

  it('without an order id the page stays the "outcome unknown" page and never says "placed"', async () => {
    renderWithProviders(<>{await OrderUnknownRoute({ params, searchParams: Promise.resolve({}) })}</>);
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Check your orders/i })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Order placed/);
  });

  it('an id that is not a plain id is ignored', async () => {
    await OrderUnknownRoute({ params, searchParams: Promise.resolve({ orderId: '../x' }) });
    expect(redirect).not.toHaveBeenCalled();
  });
});
