import { screen, within } from '@testing-library/react';
import { HOME_CONFIG } from '@/lib/config/home';
import { popularAddons } from '@/lib/home/derive';
import { renderWithProviders } from '@/test/utils';
import { ADDON_OFFERS, HOME_TREE } from './__fixtures__/home';
import { PopularAddons } from './PopularAddons';

const addons = () => popularAddons(ADDON_OFFERS, HOME_CONFIG.popularAddonOfferKeys, HOME_CONFIG.popularAddonCount);

describe('PopularAddons', () => {
  it('shows four tiles with a monthly price that open the add-on card', () => {
    renderWithProviders(<PopularAddons locale="en-US" tree={HOME_TREE} addons={addons()} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText('Spotify')).toBeInTheDocument();
    expect(within(items[0]!).getByText('$10/mo')).toBeInTheDocument();
    expect(within(items[3]!).getByText('$8/mo')).toBeInTheDocument();
    expect(within(items[0]!).getByRole('link').getAttribute('href')).toContain('/en-US/shop/streaming-entertainment?offer=malva-offer-spotify');
  });

  it('"View all" links to the add-ons listing', () => {
    renderWithProviders(<PopularAddons locale="en-US" tree={HOME_TREE} addons={addons()} />);
    expect(screen.getByRole('link', { name: 'View all →' })).toHaveAttribute('href', '/en-US/shop/add-ons');
  });

  it('the band is hidden with no add-ons', () => {
    renderWithProviders(<PopularAddons locale="en-US" tree={HOME_TREE} addons={[]} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
