import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ pathname: '/account' }));

vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { AccountNav } from './AccountNav';

describe('AccountNav', () => {
  it('links to every account section and has a log out button', () => {
    renderWithProviders(<AccountNav />);
    const nav = screen.getByRole('navigation', { name: 'Account' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Overview', '/en-US/account'],
      ['Orders', '/en-US/account/orders'],
      ['Addresses', '/en-US/account/addresses'],
      ['Payment methods', '/en-US/account/payment-methods'],
      ['Saved lists', '/en-US/account/lists'],
    ]);
    expect(within(nav).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('marks only the overview as current on /account', () => {
    state.pathname = '/account';
    renderWithProviders(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
  });

  it('keeps Orders current on an order detail page', () => {
    state.pathname = '/account/orders/QA-AAAA01';
    renderWithProviders(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('is a scrollable row below 1024 px and a column from 1024 px', () => {
    renderWithProviders(<AccountNav />);
    expect(screen.getByRole('navigation', { name: 'Account' })).toHaveClass('overflow-x-auto', 'lg:overflow-visible');
    expect(screen.getByRole('list')).toHaveClass('flex', 'lg:flex-col');
  });

  it('speaks German', () => {
    renderWithProviders(<AccountNav />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Bestellungen' })).toBeInTheDocument();
  });
});
