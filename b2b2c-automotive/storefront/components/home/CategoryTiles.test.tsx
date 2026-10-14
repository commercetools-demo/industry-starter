// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { homeData, renderHome } from '@/test/home';
import { CategoryTiles } from './CategoryTiles';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());

describe('Shop by category', () => {
  it('five categories show five tiles', () => {
    renderHome(<CategoryTiles />);
    expect(screen.getByRole('heading', { level: 2, name: 'Shop by category' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(5);
  });

  it('no empty tile', () => {
    renderHome(<CategoryTiles />, { home: homeData({ categories: [{ id: 'a', slug: 'brakes', name: 'Brakes' }, { id: 'b', slug: 'x', name: '  ' }, { id: 'c', slug: '', name: 'No slug' }] }) });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    for (const link of links) expect(link.textContent?.trim()).not.toBe('');
  });

  it('tile links to the category slug', () => {
    renderHome(<CategoryTiles />);
    expect(screen.getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
  });

  it('excluded category has no tile', () => {
    // The store's list (HomeData.categories, the shell navigation) does not hold a withdrawn line; the block shows what it gets.
    renderHome(<CategoryTiles />, { home: homeData({ categories: [{ id: 'c1', slug: 'brakes', name: 'Brakes' }] }) });
    expect(screen.queryByRole('link', { name: 'Lighting' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders nothing without categories', () => {
    const { container } = renderHome(<CategoryTiles />, { home: homeData({ categories: [] }) });
    expect(container).toBeEmptyDOMElement();
  });

  it('view all link only with a label, to all parts', () => {
    renderHome(<CategoryTiles viewAllLabel="View all ›" title="Browse {reseller}" />);
    expect(screen.getByRole('link', { name: 'View all ›' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Browse Küstenwerk Autoteile');
  });

  it('uses tokens only', () => {
    const { container } = renderHome(<CategoryTiles />);
    expect(container.innerHTML).toContain('bg-surface-brand-deep');
    expect(container.innerHTML).toContain('hover:bg-brand-800');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('no axe violations', async () => {
    const { container } = renderHome(<CategoryTiles />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
