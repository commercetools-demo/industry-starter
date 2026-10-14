// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';
import type { FacetGroup } from '@/lib/types';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { ActiveFilters } from './ActiveFilters';

const groups: FacetGroup[] = [
  { name: 'brand', param: 'brand', title: 'Brand', options: [{ key: 'vektra', label: 'Vektra', count: 3, selected: true }, { key: 'kestrel', label: 'Kestrel', count: 2, selected: true }] },
  { name: 'position', param: 'attr.position', title: 'Position', options: [{ key: 'front', label: 'Front', count: 4, selected: true }] },
];
const view = (sp: Record<string, string | string[]>, basePath = '/mau-reseller-north/category/brakes') =>
  renderWithProviders(<ActiveFilters params={parseListingParams(sp)} basePath={basePath} groups={groups} city="Hamburg" />, { locale: 'en-US', messages: enUS });

describe('No matches: components/listing/ActiveFilters', () => {
  it('chips are removable individually', () => {
    view({ brand: ['vektra', 'kestrel'], 'attr.position': 'front', pickup: '1', sort: 'rated', page: '3' });
    const vektra = screen.getByRole('link', { name: 'Remove filter Vektra' });
    const url = new URL(vektra.getAttribute('href') as string, 'http://x');
    expect(url.pathname).toBe('/en-US/mau-reseller-north/category/brakes');
    expect(url.searchParams.getAll('brand')).toEqual(['kestrel']);
    expect(url.searchParams.get('attr.position')).toBe('front');
    expect(url.searchParams.get('pickup')).toBe('1');
    expect(url.searchParams.get('sort')).toBe('rated');
    expect(url.searchParams.has('page')).toBe(false);
    expect(screen.getByRole('link', { name: 'Remove filter Kestrel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remove filter Front' })).toBeInTheDocument();
    const pickup = screen.getByRole('link', { name: 'Remove filter Pickup today at Hamburg' });
    expect(new URL(pickup.getAttribute('href') as string, 'http://x').searchParams.has('pickup')).toBe(false);
  });

  it('clear all keeps q and category', () => {
    view({ q: 'pads', brand: 'vektra', pickup: '1', sort: 'rated', fit: '0' }, '/mau-reseller-north/search');
    const clear = screen.getByRole('link', { name: 'Clear all' });
    const url = new URL(clear.getAttribute('href') as string, 'http://x');
    expect(url.pathname).toBe('/en-US/mau-reseller-north/search');
    expect(url.searchParams.get('q')).toBe('pads');
    expect(url.searchParams.get('sort')).toBe('rated');
    expect(url.searchParams.has('brand')).toBe(false);
    expect(url.searchParams.has('pickup')).toBe(false);
    expect(url.searchParams.has('fit')).toBe(false);
  });

  it('renders nothing without active filters', () => {
    const { container } = view({ sort: 'rated' });
    expect(container).toBeEmptyDOMElement();
  });

  it('a value that is not in the facet falls back to its key', () => {
    view({ brand: 'unknown-brand' });
    expect(screen.getByRole('link', { name: 'Remove filter unknown-brand' })).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const { container } = view({ brand: 'vektra' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
