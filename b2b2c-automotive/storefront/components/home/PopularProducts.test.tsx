// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeData, product, renderHome } from '@/test/home';
import type { HomeData } from '@/lib/home/types';
import { PopularProducts } from './PopularProducts';

vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
const add = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAddToCart', () => ({ useAddToCart: () => ({ add, isAdding: false, error: null }) }));

const items = (n: number, over: Partial<ReturnType<typeof product>> = {}): HomeData['popular'] =>
  Array.from({ length: n }, (_, i) => ({ product: product({ id: `p${i}`, sku: `SKU-${i}`, slug: `part-${i}`, name: `Part ${i}`, ...over }), fit: 'unknown' as const }));

beforeEach(() => add.mockReset());

describe('Popular products at this store', () => {
  it('renders count between 4 and 8', () => {
    renderHome(<PopularProducts count={5} />, { home: homeData({ popular: items(8) }) });
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it('count above eight or below four is clamped', () => {
    const { unmount } = renderHome(<PopularProducts count={99} />, { home: homeData({ popular: items(8) }) });
    expect(screen.getAllByRole('article')).toHaveLength(8);
    unmount();
    renderHome(<PopularProducts count={1} />, { home: homeData({ popular: items(8) }) });
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('heading and view all link', () => {
    renderHome(<PopularProducts />, { home: homeData({ popular: items(4) }) });
    expect(screen.getByRole('heading', { level: 2, name: 'Popular at Küstenwerk Autoteile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all ›' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
  });

  it('badge in stock names the city', () => {
    renderHome(<PopularProducts />, { home: homeData({ popular: items(4) }) });
    expect(screen.getAllByText('In stock · Hamburg')).toHaveLength(4);
  });

  it('badge ships in 2–3 days otherwise', () => {
    renderHome(<PopularProducts />, { home: homeData({ popular: items(4, { stock: { atBranch: false, quantity: 0 } }) }) });
    expect(screen.getAllByText('Ships in 2–3 days')).toHaveLength(4);
  });

  it('only fitting products with a vehicle', () => {
    // The server read (lib/ct/home.test.ts) searches fit-only with the vehicle's keys; the block shows each card's fit state.
    const popular: HomeData['popular'] = [{ product: product({ id: 'f1', name: 'Fitting pad' }), fit: 'fits' }];
    renderHome(<PopularProducts />, { home: homeData({ popular, vehicle: { id: 'v', make: 'VW', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 VW Golf' } }) });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Fitting pad')).toBeInTheDocument();
  });

  it('no vehicle lists popular products', () => {
    renderHome(<PopularProducts />, { home: homeData({ popular: items(4) }) });
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('renders nothing when there are no popular products', () => {
    const { container } = renderHome(<PopularProducts />, { home: homeData({ popular: [] }) });
    expect(container).toBeEmptyDOMElement();
  });

  it('price and old price', () => {
    renderHome(<PopularProducts />, { home: homeData({ popular: items(1, { price: { centAmount: 4990, currencyCode: 'USD', fractionDigits: 2, oldCentAmount: 5490 } }) }), locale: 'en-US' });
    const card = screen.getByRole('article');
    expect(within(card).getByText('$49.90')).toBeInTheDocument();
    expect(card.querySelector('s')).toHaveTextContent('$54.90');
  });

  it('add to cart calls the shared hook', async () => {
    add.mockResolvedValue(true);
    renderHome(<PopularProducts />, { home: homeData({ popular: items(1) }) });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(add).toHaveBeenCalledWith('SKU-0', 1);
  });

  it('no axe violations', async () => {
    const { container } = renderHome(<PopularProducts />, { home: homeData({ popular: items(4) }) });
    expect(await axe(container)).toHaveNoViolations();
  });
});
