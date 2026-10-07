import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildNavItems } from '@/lib/nav';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
}));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));

import { MobileDrawer } from './MobileDrawer';

const ROOTS = [
  ['phone-plans', 'Phone plans'],
  ['cable-internet', 'Cable internet'],
  ['add-ons', 'Add-ons'],
];
const TREE: Category[] = ROOTS.map(([slug, name]) => ({ id: slug, key: slug, name, slug, slugs: { 'en-US': slug, 'de-DE': slug }, children: [] }));
const ITEMS = buildNavItems(TREE, 'en-US');

function drawer() {
  return renderWithProviders(<MobileDrawer items={ITEMS} account={<button type="button">Account slot</button>} locale="en-US" />);
}

const menuButton = () => screen.getByRole('button', { name: 'Open menu' });

beforeEach(() => {
  state.pathname = '/';
  document.body.className = '';
});

describe('MobileDrawer', () => {
  it('is closed by default and only the menu button shows', () => {
    drawer();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveAttribute('aria-controls', 'mobile-drawer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on click with aria-expanded true, a dialog and focus on the close button', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('id', 'mobile-drawer');
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
  });

  it('lists the categories in order, the account slot and the language switch', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    const nav = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Phone plans', 'Cable internet', 'Add-ons']);
    expect(screen.getByRole('button', { name: 'Account slot' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language and region' })).toBeInTheDocument();
  });

  it('Tab and Shift+Tab cycle inside the panel', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 12; i += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('Esc closes and focus returns to the menu button', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('the close button closes and focus returns to the menu button', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('backdrop click closes', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    await user.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('following a category link closes the drawer', async () => {
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Cable internet' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a route change closes the drawer', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [, setTick] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              state.pathname = '/shop/cable-internet';
              setTick(1);
            }}
          >
            navigate
          </button>
          <MobileDrawer items={ITEMS} account={null} locale="en-US" />
        </>
      );
    }
    renderWithProviders(<Harness />);
    await user.click(menuButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'navigate' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('body overflow is locked while open and restored on close and on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = drawer();
    await user.click(menuButton());
    expect(document.body).toHaveClass('overflow-hidden');
    await user.keyboard('{Escape}');
    expect(document.body).not.toHaveClass('overflow-hidden');
    await user.click(menuButton());
    expect(document.body).toHaveClass('overflow-hidden');
    unmount();
    expect(document.body).not.toHaveClass('overflow-hidden');
  });

  it('the active item has aria-current page', async () => {
    state.pathname = '/shop/add-ons';
    const user = userEvent.setup();
    drawer();
    await user.click(menuButton());
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Add-ons');
  });

  it('the menu button and close button are 44 px touch targets', async () => {
    const user = userEvent.setup();
    drawer();
    expect(menuButton()).toHaveClass('min-h-11', 'min-w-11');
    await user.click(menuButton());
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveClass('min-h-11', 'min-w-11');
  });

  it('the button is hidden from md up', () => {
    const { container } = drawer();
    expect(container.firstElementChild).toHaveClass('md:hidden');
  });
});
