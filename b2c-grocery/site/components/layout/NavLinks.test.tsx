import { screen } from '@testing-library/react';
import { parseListingParams } from '@/lib/listing-params';
import { renderWithProviders } from '@/test/utils';
import { NAV_ITEMS, NavLinks } from './NavLinks';

describe('NavLinks targets for the listing', () => {
  it('Shop and New in link to /shop and /shop?sort=newest, which the listing parses', () => {
    renderWithProviders(<NavLinks active={null} />);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.getByRole('link', { name: 'New in' })).toHaveAttribute('href', '/en-US/shop?sort=newest');
    const newIn = NAV_ITEMS.find((i) => i.key === 'new');
    expect(parseListingParams(Object.fromEntries(new URLSearchParams(newIn?.href.split('?')[1]))).sort).toBe('newest');
  });
});
