// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/vehicle/GarageBar', () => ({ GarageBar: () => <div data-testid="garage-bar" /> }));
vi.mock('@/components/listing/SortSelect', () => ({ SortSelect: ({ value }: { value: string }) => <div data-testid="sort" data-value={value} /> }));

import { ResultHeader, type ResultHeaderProps } from './ResultHeader';

const base: ResultHeaderProps = { store: 'mau-reseller-north', title: 'Brake pads', crumbs: [{ label: 'Brakes', href: '/mau-reseller-north/category/brakes' }], count: 12, city: 'Hamburg', sort: 'popular', hasQuery: false };
const view = (over: Partial<ResultHeaderProps> = {}) => renderWithProviders(<ResultHeader {...base} {...over} />, { locale: 'en-US', messages: enUS });

describe('Page header states context: components/listing/ResultHeader', () => {
  it('breadcrumb current page', () => {
    view();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US/mau-reseller-north');
    expect(within(nav).getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
    expect(within(nav).getByText('Brake pads')).toHaveAttribute('aria-current', 'page');
  });

  it('title and count line with the store city', () => {
    view();
    expect(screen.getByRole('heading', { level: 1, name: 'Brake pads' })).toBeInTheDocument();
    expect(screen.getByText('12 parts · prices and stock for Hamburg')).toBeInTheDocument();
  });

  it('one part reads singular and a store without a city drops the city', () => {
    view({ count: 1, city: undefined });
    expect(screen.getByText('1 part')).toBeInTheDocument();
  });

  it('title for search', () => {
    view({ title: 'Results for "MLV-BP-41001"', crumbs: [], hasQuery: true, sort: 'relevance' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for "MLV-BP-41001"');
    expect(screen.getByTestId('sort')).toHaveAttribute('data-value', 'relevance');
  });

  it('shows the garage bar and the filter button slot', () => {
    view({ filterButton: <button type="button">Filters</button> });
    expect(screen.getByTestId('garage-bar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const { container } = view();
    expect(await axe(container)).toHaveNoViolations();
  });
});
