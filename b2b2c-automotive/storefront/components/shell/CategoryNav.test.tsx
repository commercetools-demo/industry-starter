// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const path = vi.hoisted(() => ({ current: '/mau-reseller-north' }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => path.current,
}));

import { CategoryNav } from './CategoryNav';

const categories = [
  { id: 'c1', slug: 'brakes', name: 'Brakes' },
  { id: 'c2', slug: 'filters', name: 'Filters' },
];
const nav = () => renderWithProviders(<CategoryNav store="mau-reseller-north" categories={categories} />, { locale: 'en-US', messages: enUS });

beforeEach(() => {
  path.current = '/mau-reseller-north';
});

describe('Category navigation and active state', () => {
  it('all parts is first', () => {
    nav();
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['All parts', 'Brakes', 'Filters']);
    expect(links[0]).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
    expect(links[1]).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
  });
  it('underlines the active category', () => {
    path.current = '/mau-reseller-north/category/filters';
    nav();
    const active = screen.getByRole('link', { name: 'Filters' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('border-border-brand');
    expect(screen.getByRole('link', { name: 'Brakes' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Brakes' }).className).toContain('border-transparent');
  });
  it('a product page below a category keeps the category active, all parts for the parts page', () => {
    path.current = '/mau-reseller-north/category/brakes/page-2';
    nav();
    expect(screen.getByRole('link', { name: 'Brakes' })).toHaveAttribute('aria-current', 'page');
    path.current = '/mau-reseller-north/parts';
    nav();
    expect(screen.getAllByRole('link', { name: 'All parts' }).at(-1)).toHaveAttribute('aria-current', 'page');
  });
  it('excluded category has no link anywhere in the shell', () => {
    nav();
    expect(screen.queryByRole('link', { name: 'Lighting' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="lighting"]')).toBeNull();
  });
  it('the list scrolls sideways and does not wrap', () => {
    nav();
    const list = screen.getByRole('list');
    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).toContain('whitespace-nowrap');
  });
  it('has no axe violations', async () => {
    const { container } = nav();
    expect(await axe(container)).toHaveNoViolations();
  });
});
