import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { UpsellBand } from './UpsellBand';

describe('UpsellBand', () => {
  it('names the add-ons and links to the add-ons listing', () => {
    renderWithProviders(<UpsellBand names={['Spotify', 'Apple TV+']} href="/shop/add-ons" />);
    expect(screen.getByRole('heading', { name: 'Make it yours with add-ons' })).toBeInTheDocument();
    expect(screen.getByText('Spotify and Apple TV+ and more can be added to any plan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse add-ons' })).toHaveAttribute('href', '/en-US/shop/add-ons');
  });

  it('joins the names in the language of the page', () => {
    renderWithProviders(<UpsellBand names={['Spotify', 'Apple TV+']} href="/shop/zusatzoptionen" />, { locale: 'de-DE' });
    expect(screen.getByText('Spotify und Apple TV+ und mehr lassen sich zu jedem Tarif hinzufügen.')).toBeInTheDocument();
  });

  it('renders nothing without names or without a link target', () => {
    const first = renderWithProviders(<UpsellBand names={[]} href="/shop/add-ons" />);
    expect(screen.queryByRole('heading')).toBeNull();
    first.unmount();
    renderWithProviders(<UpsellBand names={['Spotify']} href={null} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
