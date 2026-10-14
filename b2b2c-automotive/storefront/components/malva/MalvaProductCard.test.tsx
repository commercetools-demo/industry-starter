// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { MalvaProductSummary } from '@/lib/malva-types';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const drawer = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), isOpen: false }));
vi.mock('@/components/malva/FinderDrawerProvider', () => ({ useFinderDrawer: () => drawer }));
vi.mock('@/components/vehicle/FitBadge', () => ({ FitBadge: ({ state }: { state: string }) => <span data-testid="fit">{state}</span> }));

import { MalvaProductCard } from './MalvaProductCard';

const product: MalvaProductSummary = {
  id: 'p1',
  sku: 'SK-1001',
  partNumber: 'SK-1001',
  name: 'Vektra front brake pad set, ceramic',
  slug: 'vektra-front-brake-pad-set',
  brand: 'Vektra',
  imageUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  imageAlt: 'Brake pads',
  universalFit: false,
  fitmentKeys: [],
};

const renderCard = (over: Partial<MalvaProductSummary> = {}, locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(<MalvaProductCard product={{ ...product, ...over }} fit="fits" />, { locale, messages: locale === 'en-US' ? enUS : deDE });

describe('MalvaProductCard', () => {
  it('shows image, uppercase brand, name, part number and the fit badge', () => {
    const { container } = renderCard();
    expect(screen.getByRole('img', { name: 'Brake pads' })).toBeInTheDocument();
    expect(screen.getByText('Vektra').className).toContain('uppercase');
    expect(screen.getByRole('heading', { name: 'Vektra front brake pad set, ceramic' }).className).toContain('line-clamp-2');
    expect(screen.getByText('Part no. SK-1001')).toBeInTheDocument();
    expect(screen.getByTestId('fit')).toHaveTextContent('fits');
    expect(container).toBeInTheDocument();
  });

  it('has no price, stock, Add to cart or link', () => {
    const { container } = renderCard();
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).not.toMatch(/\$|€|price|preis|in stock|lager|add to cart|in den warenkorb/i);
    expect(screen.queryByRole('button', { name: /add to cart/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a text fallback when the product has no photo and omits an empty brand', () => {
    renderCard({ imageUrl: undefined, brand: '' });
    expect(screen.getByText('No photo')).toBeInTheDocument();
    expect(screen.queryByText('Vektra')).toBeNull();
  });

  it('opens the finder drawer with the product slug and the button as opener', async () => {
    drawer.open.mockClear();
    const user = userEvent.setup();
    renderCard();
    const button = screen.getByRole('button', { name: 'Select a reseller for Vektra front brake pad set, ceramic' });
    expect(button).toHaveTextContent('Select a reseller');
    await user.click(button);
    expect(drawer.open).toHaveBeenCalledWith({ productSlug: 'vektra-front-brake-pad-set', opener: button });
  });

  it('reads German', () => {
    renderCard({}, 'de-DE');
    expect(screen.getByRole('button')).toHaveTextContent('Händler auswählen');
    expect(screen.getByText('Teilenr. SK-1001')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderCard();
    expect(await axe(container)).toHaveNoViolations();
  });
});
