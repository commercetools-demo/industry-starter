import { screen } from '@testing-library/react';
import { Link } from '@/i18n/routing';
import { renderWithProviders } from './utils';

describe('Link from @/i18n/routing', () => {
  it('renders a de-DE href with the locale prefix', () => {
    renderWithProviders(<Link href="/shop/cable">Cable</Link>, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Cable' })).toHaveAttribute('href', '/de-DE/shop/cable');
  });

  it('renders an en-US href with the locale prefix by default', () => {
    renderWithProviders(<Link href="/bundle">Bundle</Link>);
    expect(screen.getByRole('link', { name: 'Bundle' })).toHaveAttribute('href', '/en-US/bundle');
  });
});
