import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { EmptyBundle } from './EmptyBundle';

const links = [
  { key: 'phone', href: '/shop/phone-plans' },
  { key: 'wireless', href: '/shop/home-wireless-internet' },
  { key: 'cable', href: '/shop/cable-internet' },
] as const;

describe('EmptyBundle', () => {
  it('Empty cart: shows the empty state with a route back into the catalog', () => {
    renderWithProviders(<EmptyBundle links={[...links]} />);
    expect(screen.getByRole('heading', { name: 'Your bundle is empty' })).toBeInTheDocument();
    expect(screen.getByText('Choose a plan from any category, then add extras.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Phone plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
    expect(screen.getByRole('link', { name: 'Wireless internet' })).toHaveAttribute('href', '/en-US/shop/home-wireless-internet');
    expect(screen.getByRole('link', { name: 'Cable internet' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('de-DE copy and German category links', () => {
    renderWithProviders(<EmptyBundle links={[{ key: 'phone', href: '/shop/handytarife' }]} />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { name: 'Ihr Bundle ist leer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Handytarife' })).toHaveAttribute('href', '/de-DE/shop/handytarife');
  });
});
