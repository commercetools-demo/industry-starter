// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductSummary } from '@/lib/types';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mau-reseller-north/parts',
}));
const add = vi.hoisted(() => vi.fn());
const hook = vi.hoisted(() => ({ isAdding: false, error: null as string | null }));
vi.mock('@/hooks/useAddToCart', () => ({ useAddToCart: () => ({ add, isAdding: hook.isAdding, error: hook.error }) }));

import { ProductCard, type ProductCardProps } from './ProductCard';

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 'p1',
  sku: 'MLV-BP-41001',
  slug: 'vektra-front-brake-pad-set-mlv-bp-41001',
  name: 'Vektra Front brake pad set, ceramic',
  brand: 'Vektra',
  imageUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  imageAlt: 'Brake pads',
  rating: { average: 4.5, count: 12 },
  price: { centAmount: 5490, currencyCode: 'USD', fractionDigits: 2 },
  stock: { atBranch: true, quantity: 4 },
  universalFit: false,
  fitmentKeys: [],
  recurringEligible: false,
  variantCount: 1,
  ...over,
});
const base = (over: Partial<ProductCardProps> = {}): ProductCardProps => ({
  product: product(),
  store: 'mau-reseller-north',
  fit: 'unknown',
  city: 'Hamburg',
  shipDays: { min: 2, max: 3 },
  alternativesHref: '/mau-reseller-north/parts',
  ...over,
});
const view = (props: Partial<ProductCardProps> = {}, garage = stateOf()) => renderVehicle(<ProductCard {...base(props)} />, { garage, locale: 'en-US' });

beforeEach(() => {
  add.mockReset();
  add.mockResolvedValue(true);
  hook.isAdding = false;
  hook.error = null;
  installFakeApi();
});
afterEach(() => vi.unstubAllGlobals());

describe('Product card: components/listing/ProductCard', () => {
  it('renders all card parts', () => {
    const { container } = view({ fit: 'fits' });
    const card = screen.getByRole('article');
    expect(within(card).getByText('Vektra')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Vektra Front brake pad set, ceramic' })).toHaveAttribute('href', '/en-US/mau-reseller-north/p/vektra-front-brake-pad-set-mlv-bp-41001');
    expect(container.querySelector('img')).toHaveAttribute('alt', 'Brake pads');
    expect(within(card).getByLabelText('Rated 4.5 out of 5 from 12 reviews')).toBeInTheDocument();
    expect(within(card).getByText('Fits your vehicle')).toBeInTheDocument();
    expect(within(card).getByText('$54.90')).toBeInTheDocument();
    expect(within(card).getByText('In stock · Hamburg')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  it('fit badge shows for the active vehicle', () => {
    view({ fit: 'fits' }, stateOf('volkswagen.golf.2016.2-0-tdi'));
    expect(screen.getByText('Fits your vehicle')).toBeInTheDocument();
  });

  it('no vehicle shows select your vehicle', () => {
    view({ fit: 'unknown' });
    expect(screen.getByRole('button', { name: 'Select your vehicle to check fit' })).toBeInTheDocument();
    expect(screen.queryByText('Fits your vehicle')).not.toBeInTheDocument();
  });

  it('non fitting card replaces add with view fitting alternatives', () => {
    view({ fit: 'does-not-fit', alternativesHref: '/mau-reseller-north/category/brakes' });
    expect(screen.getByText('Does not fit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View fitting alternatives' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
  });

  it('no price reads Price unavailable and disables add', () => {
    view({ product: product({ price: null }) });
    expect(screen.getByText('Price unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });

  it('out of stock at store reads ships in 2–3 days and add stays enabled', () => {
    view({ product: product({ stock: { atBranch: false, quantity: 0 } }) });
    expect(screen.getByText('Ships in 2–3 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  it('old price struck through', () => {
    view({ product: product({ price: { centAmount: 4941, currencyCode: 'USD', fractionDigits: 2, oldCentAmount: 5490 } }) });
    const old = screen.getByText('$54.90');
    expect(old.tagName).toBe('S');
    expect(screen.getByText('$49.41')).toBeInTheDocument();
    expect(screen.getByText('Was $54.90')).toHaveClass('sr-only');
  });

  it('rating is hidden when there are no reviews', () => {
    view({ product: product({ rating: null }) });
    expect(screen.queryByLabelText(/Rated/)).not.toBeInTheDocument();
  });

  it('add calls the endpoint with sku and quantity 1', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(add).toHaveBeenCalledWith('MLV-BP-41001', 1);
    expect(await screen.findByText('Added to cart')).toBeInTheDocument();
  });

  it('shows the add error and the missing price message', () => {
    hook.error = 'failed';
    const { unmount } = view();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not add this part. Please try again.');
    unmount();
    hook.error = 'price-unavailable';
    view();
    expect(screen.getByRole('alert')).toHaveTextContent('This part has no price for you right now.');
  });

  it('a product with options links to its page instead of adding', () => {
    view({ product: product({ variantCount: 3 }) });
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose options' })).toHaveAttribute('href', '/en-US/mau-reseller-north/p/vektra-front-brake-pad-set-mlv-bp-41001');
  });

  it('a card without a photo keeps the image slot', () => {
    const { container } = view({ product: product({ imageUrl: undefined }) });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('No photo')).toBeInTheDocument();
  });

  it('stock line without a city and the busy button', () => {
    hook.isAdding = true;
    view({ city: undefined });
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('no axe violations', async () => {
    const { container } = view({ fit: 'fits' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
