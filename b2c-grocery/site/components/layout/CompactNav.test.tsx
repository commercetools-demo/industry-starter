import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import en from '@/messages/en-US.json';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { renderWithProviders } from '@/test/utils';
import { CompactNav } from './CompactNav';

vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  usePathname: () => '/shop',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useSearchParams: () => new URLSearchParams(),
}));

const markets = Object.values(COUNTRY_CONFIG);

describe('CompactNav', () => {
  it('opens a drawer with the same links, search and market picker, and closes with Esc', async () => {
    renderWithProviders(<CompactNav markets={markets} />);
    const trigger = screen.getByRole('button', { name: en.nav.menu });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);

    const drawer = screen.getByRole('dialog', { name: en.nav.menu });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const primary = within(drawer).getByRole('navigation', { name: en.nav.primary });
    expect(within(primary).getAllByRole('link').map((l) => l.textContent)).toEqual([en.nav.shop, en.nav.new, en.nav.journal]);
    expect(within(primary).getByRole('link', { name: en.nav.shop })).toHaveAttribute('aria-current', 'page');
    expect(within(drawer).getByRole('link', { name: en.nav.searchPill })).toHaveAttribute('href', '/en-US/search');
    expect(within(drawer).getByRole('radiogroup', { name: en.a11y.language })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('the close button closes the drawer', async () => {
    renderWithProviders(<CompactNav markets={markets} />);
    await userEvent.click(screen.getByRole('button', { name: en.nav.menu }));
    await userEvent.click(screen.getByRole('button', { name: en.nav.closeMenu }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('following a link closes the drawer', async () => {
    renderWithProviders(<CompactNav markets={markets} />);
    await userEvent.click(screen.getByRole('button', { name: en.nav.menu }));
    await userEvent.click(screen.getByRole('link', { name: en.nav.journal }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
