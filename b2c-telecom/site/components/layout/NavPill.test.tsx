import { screen } from '@testing-library/react';
import { buildNavItems } from '@/lib/nav';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
}));

import { NavPill } from './NavPill';

function root(key: string, en: string, de: string, name: string): Category {
  return { id: key, key, name, slug: en, slugs: { 'en-US': en, 'de-DE': de }, children: [] };
}

const ITEMS = buildNavItems(
  [root('phone', 'phone-plans', 'handytarife', 'Phone plans'), root('cable', 'cable-internet', 'kabel-internet', 'Cable internet')],
  'en-US',
);

function renderPills() {
  renderWithProviders(
    <>
      {ITEMS.map((item) => (
        <NavPill key={item.key} item={item} items={ITEMS} />
      ))}
    </>,
  );
}

describe('NavPill', () => {
  it('Active category highlighted: active pill has aria-current and the dark classes, the others do not', () => {
    state.pathname = '/shop/cable-internet';
    renderPills();
    const active = screen.getByRole('link', { name: 'Cable internet' });
    const other = screen.getByRole('link', { name: 'Phone plans' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-brand-950', 'text-text-on-pink');
    expect(other).not.toHaveAttribute('aria-current');
    expect(other).not.toHaveClass('bg-brand-950');
  });

  it('no pill is active on the home page', () => {
    state.pathname = '/';
    renderPills();
    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });

  it('links to the category listing with the locale prefix', () => {
    state.pathname = '/';
    renderPills();
    expect(screen.getByRole('link', { name: 'Phone plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
  });
});
