// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { Pagination, pageWindow } from './Pagination';

const view = (page: number, totalPages: number, sp: Record<string, string | string[]> = {}) =>
  renderWithProviders(<Pagination params={parseListingParams({ ...sp, page: String(page) })} page={page} totalPages={totalPages} basePath="/mau-reseller-north/parts" />, { locale: 'en-US', messages: enUS });

describe('Pagination: components/listing/Pagination', () => {
  it('window of page numbers', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 6, null, 20]);
  });

  it('prev and next hidden at the ends', () => {
    const { unmount } = view(1, 5);
    expect(screen.queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
    unmount();
    view(5, 5);
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('rel', 'prev');
    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('links keep filters', () => {
    view(2, 5, { brand: 'vektra', sort: 'price-asc', q: 'pads' });
    const next = new URL(screen.getByRole('link', { name: 'Next' }).getAttribute('href') as string, 'http://x');
    expect(next.pathname).toBe('/en-US/mau-reseller-north/parts');
    expect(next.searchParams.get('page')).toBe('3');
    expect(next.searchParams.get('brand')).toBe('vektra');
    expect(next.searchParams.get('sort')).toBe('price-asc');
    expect(next.searchParams.get('q')).toBe('pads');
    // page 1 needs no page parameter
    const first = new URL(screen.getByRole('link', { name: 'Page 1' }).getAttribute('href') as string, 'http://x');
    expect(first.searchParams.has('page')).toBe(false);
  });

  it('marks the current page', () => {
    view(3, 5);
    const current = screen.getByRole('link', { name: 'Page 3, current page' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
  });

  it('a single page renders nothing', () => {
    const { container } = view(1, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it('no axe violations', async () => {
    const { container } = view(8, 20);
    expect(await axe(container)).toHaveNoViolations();
  });
});
