import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';

const h = vi.hoisted(() => ({ brand: 'malva-coffee' }));
vi.mock('@/i18n/routing', async () => {
  const React = await import('react');
  return {
    useBrand: () => h.brand,
    Link: ({ href, brand, children, ...rest }: { href: string; brand?: string; children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('a', { href: `/${brand ?? h.brand}/en-US${href === '/' ? '' : href}`, ...rest }, children),
  };
});

import BrandSwitcher from './BrandSwitcher';

describe('BrandSwitcher', () => {
  it('shows the current brand as the first, selected tab and links the other brand to its home', () => {
    h.brand = 'malva-drinks';
    renderWithIntl(<BrandSwitcher />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Malva Drinks', 'Malva Coffee']);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[1]).not.toHaveAttribute('aria-current');
    expect(links[1]).toHaveAttribute('href', '/malva-coffee/en-US');
  });

  it('puts Malva Coffee first on a coffee page', () => {
    h.brand = 'malva-coffee';
    renderWithIntl(<BrandSwitcher />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Malva Coffee', 'Malva Drinks']);
    expect(screen.getByRole('navigation', { name: 'Brands' })).toBeInTheDocument();
  });
});
