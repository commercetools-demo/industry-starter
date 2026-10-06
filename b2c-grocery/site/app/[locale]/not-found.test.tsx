import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import LocaleNotFound from './not-found';

describe('LocaleNotFound', () => {
  it('Unknown product: has a locale-aware path back to the shop', () => {
    renderWithProviders(<LocaleNotFound />);
    expect(screen.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en-US/contact');
  });

  it('German locale: localized links', () => {
    renderWithProviders(<LocaleNotFound />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Zurück zum Shop' })).toHaveAttribute('href', '/de-DE/shop');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Diese Seite haben wir nicht gefunden');
  });
});
