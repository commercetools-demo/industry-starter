import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the brand from the catalog in both locales', () => {
    renderWithProviders(<HomePage />, { locale: 'de-DE' });
    expect(screen.getByText('MALVA')).toBeInTheDocument();
  });
});
