// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { MalvaCategoryTiles } from './MalvaCategoryTiles';

describe('Malva category tiles', () => {
  it('the Brakes tile opens /{locale}/categories/{slug}', () => {
    renderWithProviders(<MalvaCategoryTiles categories={[{ id: 'c1', slug: 'brakes', name: 'Brakes' }]} />, { locale: 'en-US', messages: enUS });
    expect(screen.getByRole('heading', { name: 'Shop by category' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop Brakes' })).toHaveAttribute('href', '/en-US/categories/brakes');
  });
  it('a category without a name or slug is not a tile; no categories renders nothing', () => {
    const { container, rerender } = renderWithProviders(<MalvaCategoryTiles categories={[{ id: 'c1', slug: '', name: 'X' }, { id: 'c2', slug: 'x', name: ' ' }]} />, { locale: 'en-US', messages: enUS });
    expect(container).toBeEmptyDOMElement();
    rerender(<MalvaCategoryTiles categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('German strings', () => {
    renderWithProviders(<MalvaCategoryTiles categories={[{ id: 'c1', slug: 'bremsen', name: 'Bremsen' }]} />, { locale: 'de-DE', messages: deDE });
    expect(screen.getByRole('heading', { name: 'Nach Kategorie einkaufen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bremsen ansehen' })).toBeInTheDocument();
  });
});
